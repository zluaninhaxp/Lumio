const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const clone = value => JSON.parse(JSON.stringify(value));
const domains = { clienteItems: 'clients', fornecedorItems: 'suppliers', employeeItems: 'employees', estoqueItems: 'stock_items', catalogItems: 'catalog_items', pedidos: 'orders', orcamentos: 'quotes', contratos: 'contracts', tasks: 'tasks', events: 'calendar_events', transactions: 'transactions', stockMovements: 'stock_movements', entregas: 'deliveries', atendimentos: 'appointments', commissions: 'commissions' };
const preferences = { customTaskTags: [], dismissedPluginSuggestions: [], activatedPlugins: [], pluginOrder: [], businessName: '', businessType: '', taxonomy: null, onboardingExtraction: null, financialExpenseCategories: [], financialIncomeCategories: [], taskTags: [], calendarEventTypes: [], keywordMap: {}, recommendedPlugins: [] };
const empty = () => ({ ...Object.fromEntries(Object.values(domains).map(key => [key, []])), generic_plugin_items: [], preferences: clone(preferences) });
function fixture(shared = { storage: new Map(), db: new Map() }, identity = 'user-a') {
  const listeners = new Set(), cache = new Map(), timers = new Map(), alerts = [];
  let timerId = 0;
  const state = { ...Object.fromEntries(Object.keys(domains).map(key => [key, []])), ...clone(preferences), genericPluginItems: {}, chatHistory: [], messages: [], refreshContratos() {}, resetOnboardingState() { Object.assign(state, clone(preferences)); }, clearMessages() { state.messages = []; }, setChatHistory(messages) { state.chatHistory = messages; } };
  const store = { getState: () => state, setState(patch) { Object.assign(state, typeof patch === 'function' ? patch(state) : patch); listeners.forEach(fn => fn(state)); }, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
  const controls = { identity, offline: false, loseResponse: false, beforeWrite: null, getUserError: null, writes: 0, requestPending: null };
  const row = () => { if (!shared.db.has(controls.identity)) shared.db.set(controls.identity, { revision: 0, snapshot: empty(), messages: [], receipts: new Map() }); return shared.db.get(controls.identity); };
  const api = {
    auth: {
      async getUser() { return { data: { user: controls.getUserError ? null : { id: controls.identity, email: 'test@example.invalid', user_metadata: {} } }, error: controls.getUserError }; },
      async getSession() { return { data: { session: { access_token: 'test-token', user: { id: controls.identity } } }, error: null }; },
    },
    from(table) {
      let cursor = 0, owner = controls.identity;
      const query = { select() { return query; }, eq(_key, id) { if (_key === 'owner_id') owner = id; else query.id = id; return query; }, gt(_key, value) { cursor = value; return query; }, order() { return query; },
        async limit(limit) { if (controls.offline) return { error: { code: 'NETWORK' } }; return { data: owner === controls.identity ? row().messages.filter(m => m.sequence > cursor).slice(0, limit) : [] }; },
        async maybeSingle() { if (controls.offline) return { error: { code: 'NETWORK' } }; if (table === 'business_commit_receipts') return { data: owner === controls.identity && row().receipts.has(query.id) ? { revision: row().receipts.get(query.id) } : null }; return { data: table === 'profiles' ? { id: controls.identity, name: 'Test', email: 'test@example.invalid', onboarding_completed: true, created_at: '2026-01-01' } : null }; } };
      return query;
    },
    async rpc(name, args) {
      if (controls.offline) return { error: { code: 'NETWORK' } };
      if (name === 'get_business_state') return { data: { revision: row().revision, ...clone(row().snapshot) } };
      assert.equal(name, 'commit_lumio_state');
      if (row().receipts.has(args.request_id)) return { data: row().receipts.get(args.request_id) };
      if (controls.rejectValidation) return { error: { code: controls.rejectValidation } };
      controls.writes++;
      if (controls.requestPending) await controls.requestPending;
      if (controls.beforeWrite) { const callback = controls.beforeWrite; controls.beforeWrite = null; await callback(); }
      if (args.expected_revision !== row().revision) return { error: { code: 'PT409' } };
      row().snapshot = clone(args.snapshot); row().revision++;
      for (const message of args.chat_messages) if (!row().messages.some(m => m.payload.id === message.id)) row().messages.push({ sequence: row().messages.length + 1, payload: clone(message) });
      row().receipts.set(args.request_id, row().revision);
      if (controls.loseResponse) { controls.loseResponse = false; return { error: { code: 'NETWORK' } }; }
      return { data: row().revision };
    },
  };
  const storage = { async getItem(key) { return shared.storage.get(key) ?? null; }, async setItem(key, value) { shared.storage.set(key, value); }, async removeItem(key) { shared.storage.delete(key); } };
  function load(relative) {
    const filename = path.resolve(relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const requireMock = specifier => {
      if (specifier.includes('lib/supabase')) return { supabase: api, isSupabaseConfigured: true, supabaseProjectScope: 'test-project' };
      if (specifier === '../store') return { useAppStore: store };
      if (specifier.endsWith('protectedStorage')) return { protectedStorage: storage };
      if (specifier.includes('async-storage')) return { default: storage };
      if (specifier === 'react') return { useEffect() {}, useRef: initial => ({ current: initial }), useState: initial => [initial, () => {}] };
      if (specifier.endsWith('appAlert')) return { AppAlert: { alert: (...args) => alerts.push(args) } };
      if (specifier.endsWith('photoService')) return { photoService: { signedUrl: async () => null } };
      return load(path.resolve(path.dirname(filename), specifier) + '.ts');
    };
    vm.runInNewContext(code, { module, exports: module.exports, require: requireMock, setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id), Date, console }, { filename });
    return module.exports;
  }
  const service = load('src/services/businessStateService.ts');
  const chat = load('src/services/chatHistoryService.ts').chatHistoryService;
  return { ...service, chat, store, state, shared, controls, row, load, alerts, async start() { await service.businessStateService.start(controls.identity); await chat.start(controls.identity); } };
}
const task = (id, description = id) => ({ id, description, done: false });
test('success is reported only after the RPC acknowledgement; concurrent commits share one request', async () => {
  const f = fixture(); await f.start();
  let release; f.controls.requestPending = new Promise(resolve => { release = resolve; });
  f.store.setState({ tasks: [task('one')] });
  const a = f.businessStateService.commit(), b = f.businessStateService.commit();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.businessSyncStatus.get().status, 'saving'); assert.equal(f.row().snapshot.tasks.length, 0);
  release(); await Promise.all([a, b]);
  assert.equal(f.controls.writes, 1); assert.equal(f.businessSyncStatus.get().status, 'ready');
});
test('network failure preserves original and later edits; explicit retry drains them without duplication', async () => {
  const f = fixture(); await f.start(); f.controls.offline = true;
  f.store.setState({ tasks: [task('one')] }); await assert.rejects(f.businessStateService.commit());
  f.store.setState({ tasks: [...f.state.tasks, task('two')] });
  assert.equal(f.state.tasks.length, 2); assert.equal(f.businessSyncStatus.get().status, 'saving');
  f.controls.offline = false; await f.businessStateService.commit();
  assert.equal(f.row().snapshot.tasks.length, 2);
});
test('reload recovers an unconfirmed journal, scoped to its user and project, without automatically saving offline', async () => {
  const a = fixture(); await a.start(); a.controls.offline = true;
  a.store.setState({ tasks: [task('draft')] }); await assert.rejects(a.businessStateService.commit());
  a.businessStateService.stop();
  const b = fixture(a.shared); await b.start(); assert.equal(b.state.tasks[0].id, 'draft'); assert.equal(b.controls.writes, 0);
  await b.businessStateService.commit(); assert.equal(b.row().snapshot.tasks.length, 1);
  const c = fixture(a.shared, 'user-b'); await c.start(); assert.equal(c.state.tasks.length, 0);
});
test('independent device additions and field edits merge without overwriting confirmed remote records', async () => {
  const a = fixture(), b = fixture(a.shared); await a.start(); await b.start();
  a.store.setState({ tasks: [task('a')] }); await a.businessStateService.commit();
  b.store.setState({ tasks: [task('b')] }); await b.businessStateService.commit();
  await a.businessStateService.refresh(); assert.deepEqual(a.state.tasks.map(t => t.id).sort(), ['a', 'b']);
  a.store.setState({ tasks: a.state.tasks.map(t => t.id === 'a' ? { ...t, description: 'remote edit' } : t) }); await a.businessStateService.commit();
  b.store.setState({ tasks: b.state.tasks.map(t => t.id === 'a' ? { ...t, done: true } : t) }); await b.businessStateService.commit();
  assert.deepEqual(clone(b.row().snapshot.tasks.find(t => t.id === 'a')), { id: 'a', description: 'remote edit', done: true });
});
test('same-field and delete-versus-edit conflicts remain unsaved until an explicit choice', async () => {
  const a = fixture(); await a.start(); a.store.setState({ tasks: [task('a')] }); await a.businessStateService.commit();
  const b = fixture(a.shared); await b.start();
  a.store.setState({ tasks: [task('a', 'remote')] }); await a.businessStateService.commit();
  b.store.setState({ tasks: [task('a', 'local'), task('independent')] }); await assert.rejects(b.businessStateService.commit());
  assert.equal(b.businessSyncStatus.get().status, 'conflict'); assert.equal(b.state.tasks[0].description, 'local');
  await b.businessStateService.resolveConflict('remote'); assert.equal(b.row().snapshot.tasks.find(t => t.id === 'a').description, 'remote');
  assert.ok(b.row().snapshot.tasks.some(t => t.id === 'independent'));
  const merge = b.load('src/services/syncMerge.ts').mergeSnapshots;
  assert.equal(merge({ tasks: [task('a')] }, { tasks: [] }, { tasks: [task('a', 'changed')] }).conflicts.length, 1);
});
test('revision change during a write is retried safely; edits arriving in-flight are not discarded', async () => {
  const f = fixture(); await f.start(); f.store.setState({ tasks: [task('local')] });
  f.controls.beforeWrite = () => { f.row().snapshot.tasks.push(task('remote')); f.row().revision++; f.store.setState({ tasks: [task('local'), task('later')] }); };
  await f.businessStateService.commit(); assert.deepEqual(f.row().snapshot.tasks.map(t => t.id).sort(), ['later', 'local', 'remote']);
});
test('lost response does not duplicate business records or chat; history restoration never executes commands', async () => {
  const f = fixture(); await f.start(); f.store.setState({ tasks: [task('business')] });
  await f.chat.stage([{ id: 'msg-1', type: 'bot', text: 'Saved', cards: [{ kind: 'task', title: 'business' }], timestamp: new Date() }]);
  f.controls.loseResponse = true; await assert.rejects(f.businessStateService.commit()); await f.businessStateService.commit();
  assert.equal(f.row().snapshot.tasks.length, 1); assert.equal(f.row().messages.length, 1);
  const reopened = fixture(f.shared); await reopened.start(); assert.equal(reopened.state.chatHistory.length, 1); assert.equal(reopened.state.chatHistory[0].cards[0].title, 'business'); assert.equal(reopened.controls.writes, 0);
});
test('chat drafts recover after reload; only confirmed messages enter the visible success history', async () => {
  const f = fixture(); await f.start(); await f.chat.stage([{ id: 'draft-msg', type: 'user', text: 'test', timestamp: new Date() }]);
  f.controls.offline = true; await assert.rejects(f.businessStateService.commit()); assert.equal(f.state.chatHistory.length, 0);
  const reopened = fixture(f.shared); await reopened.start(); assert.equal(reopened.chat.hasPending(), true); await reopened.businessStateService.commit(); assert.equal(reopened.state.chatHistory.length, 1);
});
test('a lost acknowledgement survives reload after another device edits the confirmed record', async () => {
  const a = fixture(); await a.start();
  a.store.setState({ tasks: [task('one')] });
  a.controls.loseResponse = true; await assert.rejects(a.businessStateService.commit());
  const b = fixture(a.shared); await b.start();
  b.store.setState({ tasks: [task('one', 'edited on second device')] }); await b.businessStateService.commit();
  a.businessStateService.stop();
  const reopened = fixture(a.shared); await reopened.start();
  assert.equal(reopened.state.tasks[0].description, 'edited on second device');
  await reopened.businessStateService.commit();
  assert.equal(reopened.controls.writes, 0);
});
test('canonical onboarding progress and generated report restore on a second device', async () => {
  const a = fixture(); await a.start();
  const draft = { responses: { stage1: 'A business' }, blockIndex: 1, showIntro: false, showAiTransition: false, followUpUsed: false, attemptCount: 0 };
  a.store.setState({ onboardingDraft: draft, pendingOnboardingExtraction: { businessName: 'A business' }, pendingOnboardingExtractionIsSimulation: false, onboardingCompleted: false });
  await a.businessStateService.commit();
  const b = fixture(a.shared); await b.start();
  assert.deepEqual(clone(b.state.onboardingDraft), draft);
  assert.equal(b.state.pendingOnboardingExtraction.businessName, 'A business');
});
test('message serializer allowlists card fields and removes explicit credentials', () => {
  const f = fixture(); const { serializeChatMessage, deserializeChatMessage } = f.load('src/services/chatSerialization.ts');
  const msg = serializeChatMessage({ id: 'one', type: 'user', text: 'api_key=sk-abcdefghijklmnop senha=secret', timestamp: new Date(), apiKey: 'secret', cards: [{ kind: 'task', title: 'test', secret: 'secret' }] });
  assert.ok(!JSON.stringify(msg).includes('secret')); assert.ok(!JSON.stringify(msg).includes('sk-')); assert.equal(deserializeChatMessage(msg).historical, true);
});
test('session restoration distinguishes a transient network failure from explicit invalidation', async () => {
  const f = fixture(); const { authService } = f.load('src/services/authService.ts');
  f.controls.getUserError = { name: 'AuthRetryableFetchError', status: 0 }; await assert.rejects(authService.restoreSession());
  f.controls.getUserError = { code: 'session_not_found', status: 401 }; assert.equal(await authService.restoreSession(), null);
  f.controls.getUserError = null; assert.equal((await authService.restoreSession()).user.id, 'user-a');
});
test('form save boundary preserves the operation across failures and ignores double submit', async () => {
  const f = fixture(); await f.start(); const save = f.load('src/hooks/use-confirmed-save.ts').useConfirmedSave();
  let applied = 0, succeeded = 0;
  const prepare = () => { applied++; f.store.setState({ tasks: [task('one')] }); return () => succeeded++; };
  f.controls.offline = true; await Promise.all([save.run(prepare), save.run(prepare)]);
  assert.equal(applied, 1); assert.equal(succeeded, 0); assert.equal(f.alerts.length, 0);
  f.controls.offline = false; await save.run(prepare); assert.equal(applied, 1); assert.equal(succeeded, 1);
});
test('an old-user response cannot hydrate or acknowledge data for a newly selected account', async () => {
  const f = fixture(); await f.start(); let release; f.controls.requestPending = new Promise(resolve => { release = resolve; });
  f.store.setState({ tasks: [task('a')] }); const request = f.businessStateService.commit(); await new Promise(resolve => setImmediate(resolve));
  f.businessStateService.stop(); f.businessStateService.clearPrivateState(); release(); await assert.rejects(request);
  assert.equal(f.state.tasks.length, 0); assert.equal(f.state.chatHistory.length, 0);
});
test('JSONB key ordering is ignored, including a retry of an already acknowledged stock snapshot', () => {
  const f = fixture(), { mergeSnapshots, snapshotsEqual } = f.load('src/services/syncMerge.ts');
  assert.equal(snapshotsEqual({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }), true);
  const base = { stock_items: [{ id: 's', quantity: 10 }] };
  assert.equal(mergeSnapshots(base, { stock_items: [{ id: 's', quantity: 9 }] }, { stock_items: [{ quantity: 9, id: 's' }] }).conflicts.length, 0);
});
test('concurrent sales cannot merge a shared stock balance twice; rejection preserves unrelated later edits', () => {
  const f = fixture(), { mergeSnapshots, conflictGroup, resolveWithRemote } = f.load('src/services/syncMerge.ts');
  const base = { stock_items: [{ id: 's', quantity: 10 }], orders: [], transactions: [], tasks: [] };
  const local = { stock_items: [{ id: 's', quantity: 9 }], orders: [{ id: 'local-order', items: [{ stockItemId: 's' }], financeTransactionId: 'local-income' }], transactions: [{ id: 'local-income' }], tasks: [task('later')] };
  const remote = { stock_items: [{ id: 's', quantity: 9 }], orders: [{ id: 'remote-order', items: [{ stockItemId: 's' }], financeTransactionId: 'remote-income' }], transactions: [{ id: 'remote-income' }], tasks: [] };
  const merged = mergeSnapshots(base, local, remote);
  assert.ok(merged.conflicts.length); assert.equal(conflictGroup(base, local, remote, merged.conflicts).canKeepLocal, false);
  const resolved = resolveWithRemote(base, local, remote);
  assert.deepEqual(clone(resolved.orders).map(row => row.id), ['remote-order']);
  assert.deepEqual(clone(resolved.transactions).map(row => row.id), ['remote-income']);
  assert.deepEqual(clone(resolved.tasks).map(row => row.id), ['later']);
});
test('inverting a definitively rejected preparation never removes an unrelated later edit', async () => {
  const f = fixture(); await f.start(); const before = f.businessStateService.capturePreparation();
  f.store.setState({ tasks: [task('invalid')] }); const after = f.businessStateService.capturePreparation();
  f.store.setState({ tasks: [task('invalid'), task('later')] });
  assert.equal(f.businessStateService.cancelRejectedPreparation(before, after), true); assert.deepEqual(clone(f.state.tasks).map(t => t.id), ['later']);
  f.store.setState({ tasks: [task('invalid')] }); const baseline = f.businessStateService.capturePreparation();
  f.store.setState({ tasks: [task('invalid', 'edited afterward')] });
  assert.equal(f.businessStateService.cancelRejectedPreparation(before, baseline), false); assert.equal(f.state.tasks[0].description, 'edited afterward');
});

// Execute the actual screen callbacks against the persistence fixture (no native renderer).
function chatScreen(f) {
  const source = fs.readFileSync('app/(tabs)/chat.tsx', 'utf8');
  const ast = ts.createSourceFile('chat.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const screen = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ChatScreen');
  const names = ['commitMessages', 'runChatAction', 'drainQueue', 'enqueueText', 'retryMessages', 'handleSend'];
  const declarations = names.map(name => screen.body.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === name)).getText(ast)).join('\n');
  let input = 'draft', error = false, processed = [];
  const ref = current => ({ current });
  const context = {
    businessStateService: f.businessStateService, chatHistoryService: f.chat,
    useAppStore: f.store, useCallback: fn => fn,
    sendingRef: ref(false), pendingPair: ref(null), pendingCompletion: ref(null), chosenMessage: ref(null),
    optimisticUser: ref(null), queue: ref([]), draining: ref(false), submittedDraft: ref(null),
    retryableSendFailure: ref(true), sendRetryDelay: ref(5000),
    setSending() {}, setSendError(value) { error = value; }, setInput(value) { input = value; },
    processLatest: ref(text => { processed.push(text); if (text.startsWith('task:')) f.store.setState({ tasks: [...f.state.tasks, task(text)] }); return { botText: 'Processed ' + text }; }),
    refreshOrcamentos() {}, refreshContratos() {}, scrollToBottom() {},
    isRejectedValidation: f.load('src/services/persistenceErrors.ts').isRejectedValidation,
    sendError: false, input: 'draft', Date, Math, setTimeout, Promise,
  };
  vm.createContext(context);
  const code = ts.transpileModule(declarations + '\nglobalThis.handlers = { enqueueText, drainQueue, retryMessages, handleSend };', { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInContext(code, context);
  return { ...context.handlers, processed, get input() { return input; }, get error() { return error; }, async settle() { for (let i = 0; i < 60 && context.draining.current; i++) await new Promise(resolve => setTimeout(resolve, 5)); }, context };
}

test('rapid Chat sends display immediately, clear the composer, persist in order and restore on a second device', async () => {
  const f = fixture(); await f.start(); const screen = chatScreen(f);
  let release; f.controls.requestPending = new Promise(resolve => { release = resolve; });
  screen.enqueueText('first'); screen.enqueueText('second'); screen.enqueueText('third');
  assert.deepEqual(clone(f.state.chatHistory.map(m => m.text)), ['first', 'second', 'third']);
  assert.equal(screen.input, ''); assert.equal(f.state.chatHistory.every(m => m.pending), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.state.chatHistory.some(m => m.type === 'bot'), false);
  release(); await screen.settle();
  assert.deepEqual(Array.from(screen.processed), ['first', 'second', 'third']);
  assert.equal(f.state.chatHistory.length, 6); assert.equal(new Set(f.state.chatHistory.map(m => m.id)).size, 6);
  const reopened = fixture(f.shared); await reopened.start();
  assert.deepEqual(clone(reopened.state.chatHistory.map(m => m.id)), clone(f.state.chatHistory.map(m => m.id)));
  assert.equal(reopened.state.chatHistory.every(m => !m.pending && m.historical), true);
});

test('Chat failure retains the visible user message; retry does not repeat business preparation or publish early success', async () => {
  const f = fixture(); await f.start(); const screen = chatScreen(f); f.controls.offline = true;
  screen.enqueueText('task:one'); await screen.settle();
  assert.equal(screen.error, true); assert.equal(f.state.chatHistory.length, 1); assert.equal(f.state.chatHistory[0].pending, true);
  assert.equal(f.row().snapshot.tasks.length, 0); assert.equal(screen.processed.length, 1);
  f.controls.offline = false; await screen.retryMessages();
  assert.equal(screen.processed.length, 1); assert.equal(f.row().snapshot.tasks.length, 1); assert.equal(f.state.chatHistory.length, 2);
  assert.equal(f.state.chatHistory.every(m => !m.pending), true);
});

test('Chat lost response retries use the original request and message IDs without executing commands twice', async () => {
  const f = fixture(); await f.start(); const screen = chatScreen(f); f.controls.loseResponse = true;
  screen.enqueueText('task:one'); await screen.settle();
  const originalId = f.state.chatHistory[0].id;
  assert.equal(screen.error, true); assert.equal(f.row().snapshot.tasks.length, 1); assert.equal(f.state.chatHistory.length, 1);
  await screen.retryMessages();
  assert.equal(screen.processed.length, 1); assert.equal(f.state.chatHistory[0].id, originalId);
  assert.equal(f.row().snapshot.tasks.length, 1); assert.equal(f.row().messages.length, 2); assert.equal(f.controls.writes, 1);
});

test('double taps on the same Chat draft enqueue only once', async () => {
  const f = fixture(); await f.start(); const screen = chatScreen(f);
  screen.handleSend(); screen.handleSend(); await screen.settle();
  assert.equal(screen.processed.length, 1); assert.equal(f.row().messages.length, 2);
});

test('definitively rejected Chat commands retain user text and never show a success response', async () => {
  const f = fixture(); await f.start(); const screen = chatScreen(f); f.controls.rejectValidation = '23514';
  screen.enqueueText('task:invalid'); await screen.settle();
  assert.equal(screen.error, true); assert.equal(f.state.chatHistory.length, 1); assert.equal(f.state.chatHistory[0].text, 'task:invalid');
  assert.equal(f.row().snapshot.tasks.length, 0); assert.equal(f.state.tasks.length, 0);
  assert.equal(screen.context.retryableSendFailure.current, false);
  assert.equal(f.alerts.length, 0);
});

test('Chat connection failure recovers through the background retry without repeating a business command', async () => {
  const f = fixture(); await f.start(); const screen = chatScreen(f);
  f.controls.offline = true;
  screen.enqueueText('task:background'); await screen.settle();
  assert.equal(screen.error, true); assert.equal(screen.processed.length, 1);
  const source = fs.readFileSync('app/(tabs)/chat.tsx', 'utf8');
  const ast = ts.createSourceFile('chat.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect;
  function walk(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0]?.getText(ast).includes('sendRetryDelay.current')) effect = node.arguments[0].getText(ast);
    ts.forEachChild(node, walk);
  }
  walk(ast); assert.ok(effect);
  const timers = [];
  screen.context.sendError = true;
  screen.context.setTimeout = (fn, delay) => {
    if (!delay) return setTimeout(fn, 0);
    timers.push({ fn, delay }); return timers.length;
  };
  screen.context.clearTimeout = () => {};
  vm.runInContext(ts.transpileModule('(' + effect + ')();', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, screen.context);
  assert.equal(timers.length, 1); assert.equal(timers[0].delay, 5000);
  f.controls.offline = false; timers[0].fn(); await screen.settle();
  assert.equal(screen.error, false); assert.equal(screen.processed.length, 1);
  assert.equal(f.row().snapshot.tasks.length, 1);
  assert.equal(f.row().messages.length, 2);
  assert.equal(f.alerts.length, 0);
});

test('Chat content growth and keyboard layout follow the bottom only while the reader is following', () => {
  const source = fs.readFileSync('app/(tabs)/chat.tsx', 'utf8');
  const ast = ts.createSourceFile('chat.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const screen = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ChatScreen');
  const names = ['scrollToBottom', 'preserveCardReading', 'handleContentResize'];
  const declarations = names.map(name => screen.body.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === name)).getText(ast)).join('\n');
  let scrolled = 0; const timers = [];
  const context = { scrollFrame: { current: null }, requestAnimationFrame: fn => { timers.push(fn); return timers.length; }, useCallback: fn => fn, followContentResize: { current: true }, flatListRef: { current: { scrollToEnd() { scrolled++; } } }, setTimeout: fn => timers.push(fn) };
  vm.createContext(context); vm.runInContext(ts.transpileModule(declarations + '\nglobalThis.handlers = {scrollToBottom, preserveCardReading, handleContentResize};', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  const { scrollToBottom, preserveCardReading, handleContentResize } = context.handlers;
  handleContentResize(); timers.splice(0).forEach(fn => fn()); assert.equal(scrolled, 1);
  handleContentResize(); preserveCardReading(); timers.splice(0).forEach(fn => fn()); assert.equal(scrolled, 1);
  handleContentResize(); assert.equal(timers.length, 0);
  scrollToBottom(); timers.splice(0).forEach(fn => fn()); assert.equal(scrolled, 2);
  assert.match(source, /onScrollBeginDrag=/); assert.match(source, /removeClippedSubviews=\{false\}/);
});
