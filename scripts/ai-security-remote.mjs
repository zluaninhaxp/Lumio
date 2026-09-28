import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const publicKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publicKey || !serviceKey) throw new Error('Server-side test requires SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.');
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const createdUsers = [];
const passed = [];
let stage = 'create isolated accounts';
const check = (condition, name) => { assert.ok(condition, name); passed.push(name); };
const context = { submittedAt: new Date().toISOString(), businessNameGuess: 'Padaria de teste', businessTypeGuess: 'Padaria', answers: [
  { blockId: 'identidade', question: 'Qual seu negocio?', answer: 'Padaria de bairro que vende paes e bolos para moradores.' },
  { blockId: 'rotina', question: 'Como funciona sua rotina?', answer: 'Compramos farinha, assamos paes, vendemos no balcao e entregamos encomendas.' },
] };
async function account() {
  const email = `lumio-ai-audit-${randomUUID()}@example.invalid`, password = `${randomUUID()}-Aa1`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error('Test account creation failed');
  createdUsers.push(created.data.user.id);
  const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) throw new Error('Test account login failed');
  return { id: created.data.user.id, client, email, password, token: signed.data.session.access_token };
}
async function call(account, body) {
  const response = await fetch(`${url}/functions/v1/ai`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: publicKey, ...(account ? { Authorization: `Bearer ${account.token}` } : {}) }, body: JSON.stringify(body) });
  const data = await response.json(); return { status: response.status, data };
}
try {
  const a = await account();
  stage = 'new account status';
  check((await call(a, { action: 'status' })).data.configured === false, 'new A has no credential');
  const denied = await a.client.from('ai_credentials').select('*');
  check(!!denied.error, 'direct authenticated table access denied');
  check((await call(null, { action: 'status' })).status === 401, 'unauthenticated function access denied');
  check((await call(a, { action: 'status', userId: 'forged-owner' })).status === 400, 'forged ownership rejected');
  check((await call(a, { action: 'generate', context })).data.error === 'missing_key', 'generation without stored credential gives missing_key');
  stage = 'draft key validation';
  const invalid = await call(a, { action: 'test', key: 'test-only-invalid-provider-credential' });
  check(invalid.data.error === 'provider_rejected_key', 'real provider rejects invalid draft key');
  check((await call(a, { action: 'status' })).data.configured === false, 'testing draft did not persist credential');
  const invalidSave = await call(a, { action: 'set_key', key: 'test-only-invalid-provider-credential' });
  check(invalidSave.data.error === 'provider_rejected_key', 'invalid provider key cannot be saved');
  check((await call(a, { action: 'status' })).data.configured === false, 'invalid save left account unconfigured');
  const optionalKey = process.env.LUMIO_AI_TEST_KEY;
  let realGeneration = false;
  if (optionalKey) {
    stage = 'valid provider full generation';
    check((await call(a, { action: 'test', key: optionalKey })).data.ok === true, 'real provider accepts draft');
    const saved = await call(a, { action: 'set_key', key: optionalKey });
    check(saved.data.configured === true && !JSON.stringify(saved.data).includes(optionalKey), 'valid key saved without returning secret');
    check((await call(a, { action: 'test' })).data.ok === true, 'stored credential test succeeds');
    const generated = await call(a, { action: 'generate', context });
    check(generated.status === 200 && JSON.parse(generated.data.text).taxonomyVersion === 2, 'real Gemini personalization succeeds');
    realGeneration = true;
  } else {
    // Synthetic encrypted-shaped row verifies real ownership/status/removal only.
    // It is never decrypted or used for a provider request.
    stage = 'owner status fixture';
    const inserted = await admin.from('ai_credentials').insert({ owner_id: a.id, nonce: `\\x${randomBytes(12).toString('hex')}`, ciphertext: `\\x${randomBytes(32).toString('hex')}`, key_version: 1 });
    check(!inserted.error, 'isolated encrypted-shaped status fixture created');
  }
  check((await call(a, { action: 'status' })).data.configured === true, 'A status comes from backend row');
  stage = 'logout A and new B';
  check(!(await a.client.auth.signOut()).error, 'A logged out');
  const b = await account();
  check((await call(b, { action: 'status' })).data.configured === false, 'new B remains unconfigured after A logout');
  check((await call(b, { action: 'delete_key' })).data.configured === false, 'B removal applies only to B');
  check((await admin.from('ai_credentials').select('owner_id').eq('owner_id', a.id).maybeSingle()).data?.owner_id === a.id, 'B cannot delete A credential');
  const relogin = await a.client.auth.signInWithPassword({ email: a.email, password: a.password });
  if (relogin.error) throw new Error('Test re-login failed');
  a.token = relogin.data.session.access_token;
  check((await call(a, { action: 'delete_key' })).data.configured === false, 'A can remove own credential');
  check((await call(a, { action: 'status' })).data.configured === false, 'removal confirmed by backend status');
  console.log(JSON.stringify({ passed: passed.length, checks: passed, realGeneration, provider: realGeneration ? 'full valid-key flow verified' : 'invalid-key path verified; valid-key generation still requires LUMIO_AI_TEST_KEY' }, null, 2));
} catch {
  console.error(JSON.stringify({ failedStage: stage, completedChecks: passed }, null, 2));
  process.exitCode = 1;
} finally {
  for (const id of createdUsers) {
    const deleted = await admin.auth.admin.deleteUser(id);
    if (deleted.error) { console.error('Failed to remove an isolated test account'); process.exitCode = 1; }
  }
  console.log(`Removed ${createdUsers.length} isolated test accounts.`);
}
