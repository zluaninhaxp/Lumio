// @ts-nocheck -- Deno Edge runtime types are checked separately.
import { admin, authorized, hex, limited, readLimitedBody, unhex } from '../_shared/secure.ts';
import { buildOnboardingExtractionPrompt } from '../_shared/onboarding-prompt.ts';
import { parsePersonalization, validContext } from '../_shared/ai-validation.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
const keyCheckModel = 'gemini-2.5-flash';
const reportModel = 'gemini-3.5-flash-lite';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
class Failure extends Error {
  constructor(public code: string, public status: number, public providerStatus?: number) { super(code); }
}
async function encryptionKey(): Promise<CryptoKey> {
  const encoded = Deno.env.get('AI_ENCRYPTION_KEY');
  if (!encoded) throw new Failure('backend_unavailable', 503);
  const raw = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
  if (raw.length !== 32) throw new Failure('backend_unavailable', 503);
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encrypt(value: string) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, await encryptionKey(), encoder.encode(value)));
  return { nonce: hex(nonce), ciphertext: hex(ciphertext) };
}
async function credential(uid: string): Promise<string | null> {
  const { data, error } = await admin.from('ai_credentials').select('nonce,ciphertext').eq('owner_id', uid).maybeSingle();
  if (error) throw new Failure('credential_lookup_failed', 503);
  if (!data) return null;
  try { return decoder.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unhex(data.nonce) }, await encryptionKey(), unhex(data.ciphertext))); }
  catch { throw new Failure('credential_unavailable', 503); }
}
async function generate(key: string, prompt: string, jsonMode: boolean, selectedModel = jsonMode ? reportModel : keyCheckModel): Promise<string> {
  console.info('[AI PROVIDER]', { request: 'started', structured: jsonMode, model: selectedModel });
  const maxAttempts = jsonMode ? 1 : 2;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), jsonMode ? 55000 : 20000);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, ...(jsonMode ? { responseMimeType: 'application/json', maxOutputTokens: 16384, ...(selectedModel === keyCheckModel ? { thinkingConfig: { thinkingBudget: 1024 } } : {}) } : {}) } }),
      });
      if (!response.ok) {
        let providerCode: string | undefined;
        let keyReason: string | undefined;
        try {
          const providerError = (await response.json())?.error;
          providerCode = typeof providerError?.status === 'string' ? providerError.status : undefined;
          keyReason = providerError?.details?.find(d => d.reason === 'API_KEY_INVALID' || d.reason === 'API_KEY_EXPIRED')?.reason;
        } catch { /* Never log or forward the raw provider response. */ }
        if (keyReason || [401, 403].includes(response.status)) throw new Failure('provider_rejected_key', 400, response.status);
        if (response.status === 429) throw new Failure('provider_quota', 429, 429);
        if (response.status === 400 && providerCode === 'FAILED_PRECONDITION') throw new Failure('provider_precondition', 502, 400);
        if (response.status === 400) throw new Failure('provider_invalid_request', 502, 400);
        if (response.status === 404) throw new Failure('provider_model_unavailable', 502, 404);
        throw new Failure('provider_unavailable', 502, response.status);
      }
      let body;
      try { body = await response.json(); } catch { throw new Failure('invalid_response', 502); }
      const candidate = body?.candidates?.[0];
      const text = candidate?.content?.parts?.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('').trim();
      if (!text || (candidate.finishReason && candidate.finishReason !== 'STOP')) throw new Failure('invalid_response', 502);
      console.info('[AI PROVIDER]', { response: 'success', structured: jsonMode, model: selectedModel });
      return text;
    } catch (error) {
      const failure = error instanceof Failure ? error : controller.signal.aborted ? new Failure('provider_timeout', 504) : new Failure('provider_transport_error', 502);
      if (jsonMode && selectedModel === reportModel && (
        failure.code === 'provider_timeout' || failure.code === 'provider_model_unavailable' ||
        (failure.code === 'provider_unavailable' && failure.providerStatus === 503)
      )) {
        console.info('[AI PROVIDER]', { response: 'fallback', model: keyCheckModel, code: failure.code });
        return await generate(key, prompt, true, keyCheckModel);
      }
      const transient = failure.code === 'provider_transport_error' || (failure.code === 'provider_unavailable' && (failure.providerStatus === 408 || (failure.providerStatus ?? 0) >= 500));
      if (!transient || attempt === maxAttempts - 1) throw failure;
      await new Promise(resolve => setTimeout(resolve, 600 + Math.floor(Math.random() * 400)));
    } finally { clearTimeout(timeout); }
  }
  throw new Failure('provider_unavailable', 502);
}
const keyInput = (value: unknown) => typeof value === 'string' && value.trim().length >= 20 && value.length <= 256;

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  let action = 'unknown';
  try {
    const uid = await authorized(req);
    if (!uid) {
      console.info('[AI AUTH]', { authenticated: false });
      return reply({ error: 'unauthorized' }, 401);
    }
    const bodyText = await readLimitedBody(req, 120000);
    if (bodyText === null) return reply({ error: 'invalid_input' }, 413);
    let body;
    try { body = JSON.parse(bodyText); } catch { return reply({ error: 'invalid_input' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'invalid_input' }, 400);
    const limits = { status: [120, 3600], set_key: [10, 3600], delete_key: [10, 3600], test: [10, 3600], generate: [20, 3600] };
    const fields = { status: ['action'], set_key: ['action', 'key'], delete_key: ['action'], test: ['action', 'key'], generate: ['action', 'context'] };
    if (typeof body.action !== 'string' || !Object.hasOwn(limits, body.action)) return reply({ error: 'invalid_input' }, 400);
    action = body.action;
    if (Object.keys(body).some(k => !fields[action].includes(k))) return reply({ error: 'invalid_input' }, 400);
    if ((action === 'set_key' || (action === 'test' && 'key' in body)) && !keyInput(body.key)) return reply({ error: 'invalid_input' }, 400);
    if (action === 'generate' && !validContext(body.context)) return reply({ error: 'invalid_input' }, 400);
    if (!await limited(uid, `ai_${action}`, ...limits[action])) return reply({ error: 'rate_limited' }, 429);
    if (action === 'status') {
      const { data, error } = await admin.from('ai_credentials').select('owner_id').eq('owner_id', uid).maybeSingle();
      if (error) throw new Failure('credential_lookup_failed', 503);
      console.info('[AI KEY STATUS]', { authenticated: true, configured: !!data, source: 'backend' });
      return reply({ configured: !!data });
    }
    if (action === 'delete_key') {
      const { error } = await admin.from('ai_credentials').delete().eq('owner_id', uid);
      if (error) throw new Failure('credential_write_failed', 503);
      return reply({ configured: false });
    }
    if (action === 'set_key') {
      await generate(body.key.trim(), 'Responda apenas com a palavra: ok', false);
      const encrypted = await encrypt(body.key.trim());
      const { error } = await admin.from('ai_credentials').upsert({ owner_id: uid, ...encrypted, key_version: 1, updated_at: new Date().toISOString() });
      if (error) throw new Failure('credential_write_failed', 503);
      return reply({ configured: true });
    }
    const key = action === 'test' && 'key' in body ? body.key.trim() : await credential(uid);
    console.info('[AI PERSONALIZATION]', { authenticated: true, keyFoundServerSide: !!key, source: action === 'test' && 'key' in body ? 'temporary-draft' : 'backend', action });
    if (!key) return reply({ error: 'missing_key' }, 404);
    if (action === 'test') {
      await generate(key, 'Responda apenas com a palavra: ok', false);
      return reply({ ok: true });
    }
    const prompt = buildOnboardingExtractionPrompt(body.context);
    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
      try { result = parsePersonalization(await generate(key, prompt + (attempt ? '\nA resposta anterior estava incompleta ou inválida. Retorne o schema completo em JSON válido.' : ''), true)); }
      catch (error) { if (!(error instanceof Failure) || error.code !== 'invalid_response' || attempt === 1) throw error; }
      if (result) return reply({ text: JSON.stringify(result) });
    }
    throw new Failure('invalid_response', 502);
  } catch (error) {
    const failure = error instanceof Failure ? error : new Failure('backend_unavailable', 503);
    console.warn('[AI ERROR]', { action, code: failure.code, providerStatus: failure.providerStatus ?? null });
    return reply({ error: failure.code, ...(failure.providerStatus ? { providerStatus: failure.providerStatus } : {}) }, failure.status);
  }
}
Deno.serve(handler);
