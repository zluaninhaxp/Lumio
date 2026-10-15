const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(file) {
  const auth = { ready: false, loading: true, initializationError: null, isAuthenticated: false };
  const state = [], effects = [], frames = [], calls = [];
  let cursor = 0, pathname = '/', pendingReport = false;
  const react = {
    useRef: initial => ({ current: initial }),
    useState(initial) { const slot = cursor++; if (!(slot in state)) state[slot] = initial; return [state[slot], value => { state[slot] = value; }]; },
    useEffect(fn) { effects.push(fn); },
  };
  const stubs = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
    './loading-spinner': { LoadingSpinner: 'Spinner' },
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Button', ActivityIndicator: 'Spinner' },
    'expo-router': { Redirect: 'Redirect', usePathname: () => pathname },
    'expo-splash-screen': { hideAsync: async () => { calls.push('hide'); } },
    '../hooks/useAuth': { useAuth: () => auth },
    '@/src/hooks/useAuth': { useAuth: () => auth },
    '@/src/store': { useAppStore: selector => selector({ pendingOnboardingExtraction: pendingReport }) },
    '../services/businessStateService': { businessStateService: {}, businessSyncStatus: { get: () => ({ status: 'ready' }), subscribe: () => () => {} } },
    '../constants/theme': { Colors: {}, Spacing: {}, Typography: {} },
    '../services/appAlert': { AppAlert: {} },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => {
    if (!(name in stubs)) throw new Error('Unexpected import: ' + name);
    return stubs[name];
  }, setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {} });
  const component = module.exports.default ?? module.exports.PersistenceFeedback;
  return { auth, calls, path(value) { pathname = value; }, pending(value) { pendingReport = value; },
    render() { cursor = 0; effects.length = 0; const tree = component({ children: 'Destination' }); for (const effect of effects) effect(); return tree; },
    paint() { for (const frame of frames.splice(0)) frame(); },
  };
}

test('native splash stays until session and destination are ready, then hides once', () => {
  const f = fixture('src/components/persistence-feedback.tsx');
  assert.equal(f.render().props.children, 'Destination'); f.paint(); assert.equal(f.calls.length, 0);
  f.auth.ready = true; f.auth.loading = false;
  f.render(); f.paint(); assert.equal(f.calls.length, 0, 'index must redirect before hiding');
  f.path('/chat'); f.render(); assert.equal(f.calls.length, 0);
  f.paint(); assert.equal(f.calls.length, 1);
  f.render(); f.paint(); assert.equal(f.calls.length, 1);
});

test('startup failure stays internal while recovery preserves the native splash and destination', () => {
  const f = fixture('src/components/persistence-feedback.tsx');
  f.auth.loading = false; f.auth.initializationError = 'Offline';
  assert.equal(f.render().props.children, 'Destination'); f.paint(); assert.equal(f.calls.length, 0);
  f.auth.initializationError = null; f.auth.ready = true; f.path('/chat');
  assert.equal(f.render().props.children, 'Destination'); f.paint(); assert.equal(f.calls.length, 1);
});

test('entry redirects without a timed splash and preserves login/onboarding/report destinations', () => {
  const f = fixture('app/index.tsx');
  assert.equal(f.render(), null);
  f.auth.ready = true; f.auth.loading = false;
  assert.equal(f.render().props.href, '/welcome');
  f.auth.isAuthenticated = true; f.auth.currentUser = { onboardingCompleted: false };
  assert.equal(f.render().props.href, '/onboarding');
  f.pending(true); assert.equal(f.render().props.href, '/onboarding-summary');
  f.auth.currentUser.onboardingCompleted = true;
  assert.equal(f.render().props.href, '/(tabs)/chat');
});
