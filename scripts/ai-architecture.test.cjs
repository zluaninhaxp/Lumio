const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

function loader(stubs, globals = {}) {
  const cache = new Map();
  const load = file => {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} }; cache.set(file, module.exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const requireLocal = name => {
      if (name in stubs) return stubs[name];
      const target = path.resolve(path.dirname(file), name);
      return load(fs.existsSync(target) ? target : target + '.ts');
    };
    vm.runInNewContext(code, { require: requireLocal, module, exports: module.exports, console: { info() {}, warn() {} }, Response, Request, TextEncoder, TextDecoder, AbortController, setTimeout, clearTimeout, atob, crypto: webcrypto, __DEV__: true, ...globals }, { filename: file });
    return module.exports;
  };
  return load;
}
const context = { submittedAt: '2026-09-28T00:00:00Z', businessNameGuess: 'Padaria', businessTypeGuess: 'Alimentos', answers: [{ blockId: 'identidade', question: 'Qual seu negocio?', answer: 'Padaria de bairro com entregas.' }] };
const result = { taxonomyVersion: 2, businessName: 'Padaria', segment: 'Alimentos', summary: 'Padaria de bairro.', domains: { 'financial.expense': [], 'financial.income': [], task: [{ id: 'entrega', generic: { label: 'Entrega', synonyms: ['entregar'] }, specifics: [{ id: 'pao', label: 'Pao', synonyms: ['pao'], origin: 'mentioned' }] }], calendar: [] }, recommendedPlugins: [], missingInformation: [], learnedTerms: [] };

function backend() {
  const rows = new Map(), providerCalls = [], logs = [], tokens = new Map([['token-A', 'A'], ['token-B', 'B']]);
  let responseStatus = 200, responseReason, responseText, finishReason = 'STOP', dbFail = false, timeout = false, quota = false;
  const admin = {
    auth: { getUser: async token => ({ data: { user: tokens.has(token) ? { id: tokens.get(token) } : null }, error: null }) },
    rpc: async () => ({ data: !quota, error: null }),
    from() {
      let uid, remove = false, selected;
      const query = {
        select(fields) { selected = fields; return query; },
        eq(field, value) { assert.equal(field, 'owner_id'); uid = value; return query; },
        maybeSingle: async () => ({ data: rows.has(uid) ? selected === 'owner_id' ? { owner_id: uid } : rows.get(uid) : null, error: dbFail ? new Error('db') : null }),
        upsert: async row => { if (!dbFail) rows.set(row.owner_id, row); return { error: dbFail ? new Error('db') : null }; },
        delete() { remove = true; return query; },
        then(resolve) { if (remove && !dbFail) rows.delete(uid); return Promise.resolve({ error: dbFail ? new Error('db') : null }).then(resolve); },
      }; return query;
    },
  };
  const load = loader({ 'npm:@supabase/supabase-js@2': { createClient: () => admin } }, {
    Deno: { env: { get: name => name === 'AI_ENCRYPTION_KEY' ? Buffer.alloc(32, 7).toString('base64') : 'test-only-server-value' }, serve() {} },
    console: { info: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
    setTimeout: (fn, ms) => timeout ? (queueMicrotask(fn), 0) : setTimeout(fn, ms),
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body);
      providerCalls.push({ key: options.headers['x-goog-api-key'], body });
      if (timeout) { await new Promise(resolve => setImmediate(resolve)); throw new Error('aborted'); }
      if (responseStatus !== 200) return Response.json({ error: { details: [{ reason: responseReason }] } }, { status: responseStatus });
      return Response.json({ candidates: [{ finishReason, content: { parts: [{ thought: true, text: 'private reasoning' }, { text: responseText ?? (body.generationConfig.responseMimeType ? JSON.stringify(result) : 'ok') }] } }] });
    },
  });
  const { handler } = load('supabase/functions/ai/index.ts');
  const call = async (token, body, method = 'POST') => {
    const response = await handler(new Request('https://test.invalid/ai', { method, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}), headers: token ? { Authorization: `Bearer ${token}` } : {} }));
    return { status: response.status, headers: response.headers, data: response.status === 204 ? null : await response.json() };
  };
  return { rows, providerCalls, logs, call, tokens, configure: settings => { ({ responseStatus = 200, responseReason, responseText, finishReason = 'STOP', dbFail = false, timeout = false, quota = false } = settings); } };
}

test('full A setup/test/save/generate/logout/new B flow uses encrypted owner-only backend credentials', async () => {
  const f = backend(), key = 'test-only-provider-secret-for-A';
  assert.deepEqual((await f.call('token-A', { action: 'status' })).data, { configured: false });
  assert.deepEqual((await f.call('token-A', { action: 'test', key })).data, { ok: true });
  assert.equal(f.rows.size, 0, 'testing a draft must not save');
  assert.deepEqual((await f.call('token-A', { action: 'set_key', key })).data, { configured: true });
  const encrypted = f.rows.get('A');
  assert.equal(encrypted.nonce.length, 26);
  assert.ok(!JSON.stringify(encrypted).includes(key));
  assert.deepEqual((await f.call('token-A', { action: 'status' })).data, { configured: true });
  assert.deepEqual((await f.call('token-A', { action: 'test' })).data, { ok: true });
  const generated = await f.call('token-A', { action: 'generate', context });
  assert.equal(generated.status, 200); assert.deepEqual(JSON.parse(generated.data.text), result);
  assert.equal(f.providerCalls.at(-1).key, key);
  assert.match(f.providerCalls.at(-1).body.contents[0].parts[0].text, /Padaria de bairro com entregas/);
  assert.ok(!JSON.stringify(generated.data).includes(key));
  f.tokens.delete('token-A');
  assert.equal((await f.call('token-A', { action: 'status' })).status, 401);
  assert.deepEqual((await f.call('token-B', { action: 'status' })).data, { configured: false });
  assert.equal((await f.call('token-B', { action: 'generate', context })).data.error, 'missing_key');
  assert.equal((await f.call('token-B', { action: 'delete_key' })).status, 200);
  assert.ok(f.rows.has('A'), 'B removal must leave A credential untouched');
  assert.ok(!JSON.stringify(f.logs).includes(key));
});

test('JWT, forged ownership, CORS and action payloads are enforced', async () => {
  const f = backend();
  assert.equal((await f.call(null, { action: 'status' })).status, 401);
  assert.equal((await f.call('invalid-jwt', { action: 'status' })).status, 401);
  for (const action of ['status', 'delete_key', 'test', 'generate']) assert.equal((await f.call('token-B', { action, userId: 'A', context })).status, 400);
  assert.equal((await f.call('token-A', { action: 'generate', context, key: 'test-only-extra-secret' })).status, 400);
  assert.equal((await f.call('token-A', { action: 'generate', context: {} })).status, 400);
  const preflight = await f.call(null, null, 'OPTIONS');
  assert.equal(preflight.status, 204); assert.ok(preflight.headers.get('Access-Control-Allow-Headers').includes('authorization'));
  assert.equal(f.providerCalls.length, 0);
});

test('invalid keys are never saved; key errors, quota, provider errors, timeout and database failures remain distinct', async () => {
  const f = backend(), body = { action: 'set_key', key: 'test-only-invalid-provider-secret' };
  for (const [settings, expected] of [
    [{ responseStatus: 400, responseReason: 'API_KEY_INVALID' }, 'provider_rejected_key'],
    [{ responseStatus: 400, responseReason: 'BAD_REQUEST' }, 'provider_unavailable'],
    [{ responseStatus: 429 }, 'provider_quota'], [{ responseStatus: 500 }, 'provider_unavailable'],
    [{ timeout: true }, 'provider_timeout'], [{ dbFail: true }, 'credential_write_failed'], [{ quota: true }, 'rate_limited'],
  ]) { f.configure(settings); assert.equal((await f.call('token-A', body)).data.error, expected); assert.equal(f.rows.size, 0); }
  f.configure({ dbFail: true });
  assert.equal((await f.call('token-A', { action: 'status' })).data.error, 'credential_lookup_failed');
});

test('a connection test success cannot turn malformed/truncated personalization into success', async () => {
  const f = backend(); await f.call('token-A', { action: 'set_key', key: 'test-only-provider-secret-for-A' });
  assert.equal((await f.call('token-A', { action: 'test' })).status, 200);
  for (const settings of [{ responseText: '{broken' }, { responseText: JSON.stringify({ taxonomyVersion: 2, domains: {} }) }, { finishReason: 'MAX_TOKENS' }]) {
    f.configure(settings);
    const count = f.providerCalls.length;
    assert.equal((await f.call('token-A', { action: 'generate', context })).data.error, 'invalid_response');
    assert.equal(f.providerCalls.length - count, 2, 'one bounded corrective retry');
  }
});

test('transport rejects late A responses after logout/login B and distinguishes status errors', async () => {
  let session = { user: { id: 'A' }, access_token: 'token-A' }, resolveRequest;
  const supabase = { auth: { getSession: async () => ({ data: { session }, error: null }) }, functions: { invoke: async (_name, options) => { assert.equal(options.headers.Authorization, 'Bearer token-A'); return new Promise(resolve => { resolveRequest = resolve; }); } } };
  const load = loader({ '../lib/supabase': { supabase } });
  const { invokeAiBackend } = load('src/services/ai-backend.ts');
  const pending = invokeAiBackend('status', {}, 'A');
  await new Promise(resolve => setImmediate(resolve));
  session = { user: { id: 'B' }, access_token: 'token-B' }; resolveRequest({ data: { configured: true }, error: null });
  await assert.rejects(pending, e => e.kind === 'not-authenticated');
  await assert.rejects(invokeAiBackend('status', {}, 'A'), e => e.kind === 'not-authenticated');
  supabase.functions.invoke = async () => ({ data: null, error: { context: Response.json({ error: 'credential_lookup_failed' }, { status: 503 }) } });
  await assert.rejects(invokeAiBackend('status', {}, 'B'), e => e.kind === 'status-unavailable');
  session = null; await assert.rejects(invokeAiBackend('status'), e => e.kind === 'not-authenticated');
});

test('legacy cleanup removes only known secrets without reading or migrating them', async () => {
  const removed = [];
  const load = loader({ 'expo-secure-store': { isAvailableAsync: async () => true, deleteItemAsync: async key => removed.push(key), WHEN_UNLOCKED: 1 }, '@react-native-async-storage/async-storage': { removeItem: async key => removed.push(key) } });
  await load('src/services/legacy-ai-key-cleanup.ts').clearLegacyAiKey();
  assert.deepEqual(removed.sort(), ['@lumio/ai-api-key', '@lumio/ai-api-key-fallback']);
});

test('actual status hook distinguishes four states, refreshes on focus and hides another account immediately', async () => {
  const slots = [], requests = []; let cursor = 0, focusedCallback, cleanup, pendingEffect;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
  };
  const load = loader({ react: hooks, 'expo-router': { useFocusEffect(fn) { if (fn !== focusedCallback) { cleanup?.(); focusedCallback = fn; pendingEffect = fn; } } }, '../services/ai-key-service': { aiKeyService: { status: userId => new Promise((resolve, reject) => requests.push({ userId, resolve, reject })) } } });
  const { useAiKeyStatus } = load('src/hooks/use-ai-key-status.ts');
  const render = userId => { cursor = 0; return useAiKeyStatus(userId); };
  const focus = () => { cleanup = (pendingEffect ?? focusedCallback)(); pendingEffect = null; };
  const settle = () => new Promise(resolve => setImmediate(resolve));
  assert.equal(render('A').status, 'loading'); focus();
  requests.shift().resolve(true); await settle(); assert.equal(render('A').status, 'configured');
  cleanup?.(); focus(); const lateA = requests.shift();
  assert.equal(render('B').status, 'loading', 'first B render must never expose A configuration'); focus();
  assert.equal(requests[0].userId, 'B'); requests.shift().resolve(false); await settle();
  assert.equal(render('B').status, 'notConfigured');
  lateA.resolve(true); await settle(); assert.equal(render('B').status, 'notConfigured');
  cleanup?.(); focus(); requests.shift().reject(new Error('network')); await settle();
  assert.equal(render('B').status, 'error');
  const retry = render('B').refresh(); assert.equal(render('B').status, 'loading');
  requests.shift().resolve(true); await retry; assert.equal(render('B').status, 'configured');
});
