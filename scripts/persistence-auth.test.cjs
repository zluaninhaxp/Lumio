const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function fixture() {
  const slots = [], effects = [], events = {}, calls = [];
  const user = { id: 'a', email: 'a@example.invalid', onboardingCompleted: true };
  const state = { tasks: [], hydrateOnboarding() {}, hydrateLearnedIntentMarkers() {}, resetOnboardingState() {} };
  let cursor = 0, mounted = false, tree, started = null, authListener;
  const controls = { restoreError: null, hydrationError: null, logoutError: null, restoreResult: { user }, deferredRecord: null };
  const hooks = {
    createContext: () => ({ Provider: 'Provider' }),
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback: fn => fn, useMemo: fn => fn(),
    useEffect(fn) { if (!mounted) effects.push(fn); },
  };
  const business = {
    isStarted: id => !!started && (!id || started === id), hasUnsavedChanges: () => false,
    stop() { calls.push('stop'); started = null; }, clearPrivateState() { calls.push('clear'); state.tasks = []; },
    async start(id) { calls.push('start'); started = id; }, async refresh() { calls.push('refresh'); }, async commit() { calls.push('commit'); },
  };
  const supabase = { auth: { startAutoRefresh() { calls.push('auto-start'); }, stopAutoRefresh() { calls.push('auto-stop'); }, onAuthStateChange(fn) { authListener = fn; return { data: { subscription: { unsubscribe() {} } } }; } } };
  const stubs = {
    react: hooks, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { Platform: { OS: 'android' }, AppState: { currentState: 'active', addEventListener: (name, fn) => { events[name] = fn; return { remove() {} }; } } },
    '../lib/supabase': { supabase },
    '../services/legacy-ai-key-cleanup': { clearLegacyAiKey: async () => {} },
    '../services/authService': { authService: { async restoreSession() { if (controls.restoreError) throw controls.restoreError; return controls.restoreResult; }, async login() { return { user }; }, async register() { return { user }; }, async logout() { if (controls.logoutError) throw controls.logoutError; authListener?.('SIGNED_OUT'); } } },
    '../services/userService': { userService: { getById: async () => user } },
    '../services/onboardingService': { onboardingService: { async getResponses() { if (controls.deferredRecord) await controls.deferredRecord; if (controls.hydrationError) throw controls.hydrationError; return { responses: {}, activatedPlugins: [] }; } } },
    '../repositories/learnedIntentRepository': { learnedIntentRepository: { getAll: async () => [] } },
    '../store': { useAppStore: { getState: () => state, setState: patch => Object.assign(state, patch) } },
    '../services/businessStateService': { businessStateService: business, businessSyncStatus: { reportError: message => calls.push(['error', message]), reportWarning() {} } },
    '../services/chatHistoryService': { chatHistoryService: { start: async () => {}, hasPending: () => false } },
    '../services/legacyMigrationService': { legacyMigrationService: { migrate: async () => {} } },
  };
  const code = ts.transpileModule(fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => { if (!(name in stubs)) throw Error(name); return stubs[name]; }, Error, setTimeout: fn => { fn(); }, setInterval: () => 1, clearInterval() {} });
  function render() { cursor = 0; tree = module.exports.AuthProvider({ children: 'children' }); if (!mounted) { mounted = true; effects.forEach(fn => fn()); } return tree.props.value; }
  const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); return render(); };
  return { render, settle, calls, controls, events, state };
}
test('initial network failure offers recovery instead of clearing private state or treating it as logout', async () => {
  const f = fixture(); f.state.tasks = [{ id: 'existing' }]; f.controls.restoreError = Error('offline'); f.render();
  let value = await f.settle(); assert.equal(value.initializationError, 'offline'); assert.equal(value.ready, false); assert.equal(value.loading, false); assert.equal(f.calls.includes('clear'), false);
  f.controls.restoreError = null; await value.retryInitialization(); value = f.render(); assert.equal(value.currentUser.id, 'a'); assert.equal(value.ready, true); assert.equal(value.initializationError, null);
});
test('a hydration failure is retryable; an already hydrated account survives subsequent network failures', async () => {
  const f = fixture(); f.controls.hydrationError = Error('database unavailable'); f.render(); let value = await f.settle();
  assert.ok(value.initializationError); assert.equal(value.ready, false);
  f.controls.hydrationError = null; await value.retryInitialization(); value = f.render(); f.state.tasks = [{ id: 'confirmed' }];
  const clears = f.calls.filter(c => c === 'clear').length;
  f.controls.restoreError = Error('offline'); await value.retryInitialization(); value = f.render();
  assert.equal(value.currentUser.id, 'a'); assert.equal(value.ready, true); assert.equal(f.state.tasks[0].id, 'confirmed'); assert.equal(f.calls.filter(c => c === 'clear').length, clears);
});
test('foreground refresh and native token refresh follow the application lifecycle', async () => {
  const f = fixture(); f.render(); await f.settle();
  f.events.change('background'); assert.ok(f.calls.includes('auto-stop')); assert.ok(f.calls.includes('commit'));
  f.events.change('active'); await f.settle(); assert.ok(f.calls.includes('auto-start')); assert.ok(f.calls.includes('refresh'));
});
test('failed explicit logout retains identity and private state', async () => {
  const f = fixture(); f.render(); let value = await f.settle(); f.state.tasks = [{ id: 'keep' }]; f.controls.logoutError = Error('offline');
  await assert.rejects(value.logout()); value = f.render(); assert.equal(value.currentUser.id, 'a'); assert.equal(f.state.tasks[0].id, 'keep');
});
test('an explicitly invalidated session may clear identity; temporary failures may not', async () => {
  const f = fixture(); f.render(); let value = await f.settle(); f.controls.restoreResult = null;
  await value.retryInitialization(); value = f.render(); assert.equal(value.currentUser, null); assert.equal(value.ready, true);
});
