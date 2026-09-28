// @ts-nocheck -- Deno Edge runtime types are checked by Supabase CLI.
import { admin, authorized, hex, json, limited, readLimitedBody, unhex } from '../_shared/secure.ts';

const model = 'gemini-2.5-flash';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
async function encryptionKey(): Promise<CryptoKey> {
  const encoded = Deno.env.get('AI_ENCRYPTION_KEY');
  if (!encoded) throw new Error('Encryption key missing');
  const raw = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  if (raw.length !== 32) throw new Error('Invalid encryption key');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encrypt(value: string) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, await encryptionKey(), encoder.encode(value)));
  return { nonce: hex(nonce), ciphertext: hex(ciphertext) };
}
async function decrypt(nonce: string, ciphertext: string) {
  return decoder.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unhex(nonce) }, await encryptionKey(), unhex(ciphertext)));
}
async function credential(uid: string): Promise<string | null> {
  const { data, error } = await admin.from('ai_credentials').select('nonce,ciphertext').eq('owner_id', uid).maybeSingle();
  if (error) throw new Error('Credential lookup failed');
  return data ? decrypt(data.nonce, data.ciphertext) : null;
}
async function generate(key: string, prompt: string, jsonMode: boolean): Promise<{ text?: string; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), jsonMode ? 60000 : 20000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, ...(jsonMode ? { responseMimeType: 'application/json', maxOutputTokens: 16384 } : {}) },
      }),
    });
    if (!response.ok) return { status: response.status };
    const body = await response.json();
    const text = body?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('').trim();
    return text ? { text, status: 200 } : { status: 502 };
  } finally { clearTimeout(timeout); }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const uid = await authorized(req);
  if (!uid) return json({ error: 'unauthorized' }, 401);
  const bodyText = await readLimitedBody(req, 120000);
  if (bodyText === null) return json({ error: 'invalid_input' }, 413);
  let body: Record<string, unknown>;
  try { body = JSON.parse(bodyText); } catch { return json({ error: 'invalid_input' }, 400); }
  if (!body || typeof body !== 'object' || typeof body.action !== 'string') return json({ error: 'invalid_input' }, 400);
  const action = body.action;
  const limits: Record<string, [number, number]> = {
    status: [60, 3600], set_key: [10, 3600], delete_key: [10, 3600], test: [10, 3600], generate: [20, 3600],
  };
  if (!limits[action]) return json({ error: 'invalid_input' }, 400);
  try {
    if (!await limited(uid, `ai_${action}`, ...limits[action])) return json({ error: 'rate_limited' }, 429);
    if (action === 'status') {
      const { data, error } = await admin.from('ai_credentials').select('owner_id').eq('owner_id', uid).maybeSingle();
      if (error) throw error;
      return json({ configured: !!data });
    }
    if (action === 'set_key') {
      if (typeof body.key !== 'string' || body.key.trim().length < 20 || body.key.length > 256 || Object.keys(body).some((key) => !['action', 'key'].includes(key))) return json({ error: 'invalid_input' }, 400);
      const encrypted = await encrypt(body.key.trim());
      const { error } = await admin.from('ai_credentials').upsert({ owner_id: uid, ...encrypted, key_version: 1, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ configured: true });
    }
    if (action === 'delete_key') {
      const { error } = await admin.from('ai_credentials').delete().eq('owner_id', uid);
      if (error) throw error;
      return json({ configured: false });
    }
    const key = await credential(uid);
    if (!key) return json({ error: 'missing_key' }, 404);
    if (action === 'generate' && (typeof body.prompt !== 'string' || body.prompt.length < 1 || body.prompt.length > 100000)) return json({ error: 'invalid_input' }, 400);
    const result = await generate(key, action === 'test' ? 'Responda apenas com a palavra: ok' : body.prompt as string, action !== 'test');
    if (result.status === 429) return json({ error: 'provider_quota' }, 429);
    if (result.status === 400 || result.status === 401 || result.status === 403) return json({ error: 'provider_rejected_key' }, 400);
    if (result.status !== 200) return json({ error: 'provider_unavailable' }, 502);
    return json(action === 'test' ? { ok: true } : { text: result.text });
  } catch {
    return json({ error: 'service_unavailable' }, 503);
  }
});
