const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Run the actual screens and service with deterministic hooks and in-memory IO.
// No account, API key, or Gemini request is used by these integration tests.
function fixture({ from = 'onboarding', keyValid = true, failSave = false, keySaveFails = false, testPending, savePending, settingsConfigured = true, configured = false, statusError = false, route = 'onboarding', focused = true, view, extraction = null } = {}) {
  let slots = [], cursor = 0, effects = [], tree, screen;
  const calls = [], records = [], timers = [];
  const keyboardListeners = new Map();
  const state = {
    openAnswers: {}, onboardingContext: null, onboardingCompleted: false,
    pendingOnboardingExtraction: extraction, activatedPlugins: [],
    setPendingOnboardingExtraction(value, simulation) {
      state.pendingOnboardingExtraction = value;
      state.pendingOnboardingExtractionIsSimulation = simulation;
    },
    applyOnboardingExtraction(value) {
      calls.push(['apply', value]);
      state.pendingOnboardingExtraction = null;
      state.onboardingCompleted = true;
    },
    applyOpenOnboardingConfig(answers) {
      state.openAnswers = { ...answers };
      state.onboardingContext = { answers: { ...answers } };
    },
    resetOnboardingState() { state.openAnswers = {}; state.onboardingContext = null; },
  };
  const store = Object.assign(selector => selector(state), {
    getState: () => state, setState: patch => Object.assign(state, patch),
  });
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) slots[i] = { deps, fn };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) { slots[i] = { deps }; effects.push(fn); }
    },
  };
  const component = name => name;
  const reactNative = new Proxy({
    Alert: { alert() {} },
    StyleSheet: { create: value => value, absoluteFill: {} },
    Keyboard: { isVisible: () => false, addListener: (name, listener) => { keyboardListeners.set(name, listener); return { remove() { keyboardListeners.delete(name); } }; }, dismiss() {} },
    BackHandler: { addEventListener: () => ({ remove() {} }) },
    Platform: { OS: 'web' }, useWindowDimensions: () => ({ width: 390, height: 844 }),
  }, { get: (target, key) => target[key] ?? component(key) });
  const router = { push: route => calls.push(['push', route]), replace: route => calls.push(['replace', route]), dismissTo: route => calls.push(['dismissTo', route]), back: () => calls.push(['back']) };
  const user = { id: 'test-user', onboardingCompleted: false };
  const auth = { currentUser: user, loading: false, isAuthenticated: true, refreshUser: async () => { calls.push(['refresh']); } };
  const repo = {
    async save(id, data) {
      calls.push(['save', structuredClone(data)]);
      if (failSave) throw new Error('offline');
      records.push({ userId: id, ...structuredClone(data) });
      return records.at(-1);
    },
  };
  class AIProviderError extends Error {}
  class MissingApiKeyError extends Error {}
  const stubs = {
    react: hooks, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': reactNative,
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'expo-router': { Stack: { Screen: 'StackScreen' }, useFocusEffect() {}, useRouter: () => router, useLocalSearchParams: () => ({ from, view }), useNavigation: () => ({ dispatch: action => calls.push(['reset', action]) }) },
    '@react-navigation/native': { useFocusEffect() {}, useIsFocused: () => focused, CommonActions: { reset: value => value } },
    './components/onboarding/report-detail': { default: 'ReportDetail' },
    './components/onboarding/report-intro': { default: 'ReportIntro' },
    '../src/plugins/registry': { getPluginDefinition: () => undefined },
    '../src/ai/aiOnboardingService': { extractBusinessProfile: async () => extraction, AIProviderError, MissingApiKeyError },
    '@/app/components/CelebrationText': { default: 'CelebrationText' },
    '@/app/components/onboarding/report-processing': { default: 'ReportProcessing' },
    '@/app/components/onboarding/report-error': { default: 'ReportError' },
    'react-native-reanimated': { useReducedMotion: () => false, default: { View: 'AnimatedView', Image: 'AnimatedImage' }, useSharedValue: value => hooks.useRef({ value }).current, useAnimatedStyle: fn => fn(), withTiming: value => value, withDelay: (_, value) => value, withRepeat: value => value, withSequence: (...values) => values.at(-1), cancelAnimation() {}, Easing: { out: value => value, inOut: value => value, cubic: 1, ease: 1 } },
    '../src/store': { useAppStore: store },
    '../src/hooks/useAuth': { useAuth: () => auth },
    '../src/components/api-key-input': { default: 'TextInput' },
    '../src/engine/openOnboardingEngine': null,
    '../src/data/mascotExpressions': { BLOCK_MASCOT_EXPRESSION: {}, INTERACTION_MASCOT: {} },
    'react-native-svg': { default: 'Svg', Path: 'Path' },
    './components/onboarding/lumio-speech-bubble': { default: 'SpeechBubble' },
    './components/onboarding/UserReply': { default: 'UserReply' },
    './components/onboarding/VoiceInput': { default: 'VoiceInput' },
    '../repositories/onboardingRepository': { onboardingRepository: repo },
    '../src/repositories/onboardingRepository': { onboardingRepository: repo },
    './userService': { userService: { markOnboardingCompleted: async () => { calls.push(['complete']); user.onboardingCompleted = true; return user; } } },
    './account/_shared': { AccountScreen: 'AccountScreen', AccountHeader: 'AccountHeader', sharedStyles: {} },
    '../src/hooks/use-ai-key-status': { useAiKeyStatus: () => ({ status: statusError ? 'error' : (inSettings ? settingsConfigured : configured) ? 'configured' : 'notConfigured', error: statusError ? 'Falha ao consultar IA.' : undefined, refresh: async () => { calls.push(['keyStatusRefresh']); } }) },
    '../src/services/ai-key-service': { aiKeyService: { status: async () => { calls.push(['keyStatus']); return configured; }, save: async (_draft, id) => { calls.push(['saveKey', id]); await savePending; if (keySaveFails) throw new Error('offline'); if (!keyValid) throw new AIProviderError('invalid'); }, test: async () => { calls.push(['testKey']); await testPending; if (!keyValid) throw new AIProviderError('invalid'); } } },
    '../src/ai/aiProvider': { AIProviderError, MissingApiKeyError },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const source = fs.readFileSync(file, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const module = { exports: {} };
    const localRequire = name => {
      if (name.endsWith('.png')) return name;
      if (name.endsWith('constants/theme')) return load(path.resolve('src/constants/theme.ts'));
      if (stubs[name]) return stubs[name];
      if (name === '../src/engine/openOnboardingEngine') return { OPEN_QUESTIONS: load(path.resolve('src/data/onboardingQuestions.ts')).OPEN_QUESTIONS };
      const target = path.resolve(path.dirname(file), name);
      return load(fs.existsSync(target + '.ts') ? target + '.ts' : target + '.tsx');
    };
    vm.runInNewContext(output, { require: localRequire, module, exports: module.exports, setTimeout: fn => { timers.push(fn); return timers.length; }, console }, { filename: file });
    cache.set(file, module.exports);
    return module.exports;
  }
  let inSettings = false;
  screen = load(path.resolve(`app/${route}.tsx`)).default;
  const render = () => { cursor = 0; tree = screen(); while (typeof tree?.type === 'function') tree = tree.type(tree.props); return tree; };
  async function settle() {
    for (let i = 0; i < 3; i++) {
      render(); const pending = effects; effects = []; pending.forEach(fn => fn());
      await new Promise(resolve => setImmediate(resolve));
    }
    render();
  }
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (typeof node.type === 'function') return nodes(node.type(node.props));
    if (node.type === 'Modal' && !node.props.visible) return [];
    return [node, ...nodes(node.props?.children)];
  }
  const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
  const find = predicate => { const node = nodes(tree).find(predicate); assert.ok(node, 'Expected screen element'); return node; };
  const click = async label => { await find(n => n.props?.onPress && text(n) === label).props.onPress(); await settle(); };
  async function collect() {
    await settle(); await click('Vamos lá');
    const questions = load(path.resolve('src/data/onboardingQuestions.ts')).OPEN_QUESTIONS;
    for (const question of questions) {
      const answer = 'Resposta preservada sobre ' + question.id + ': ' + 'informações do negócio '.repeat(5);
      find(n => n.type === 'TextInput').props.onChangeText(answer);
      render();
      await find(n => n.props?.accessibilityLabel === 'Enviar resposta').props.onPress();
      await settle();
    }
    return questions;
  }
  return { calls, records, state, render, nodes: () => nodes(tree), text, find, click, collect, settle,
    keyboard: async (name) => { keyboardListeners.get(name)?.({ duration: 220, endCoordinates: { height: name === 'keyboardDidShow' ? 320 : 0 } }); await settle(); },
    back: async () => { find(n => n.props?.accessibilityLabel === 'Voltar à última pergunta').props.onPress(); await settle(); },
    settings: async () => {
      const previous = { slots, screen };
      inSettings = true; slots = []; effects = []; screen = load(path.resolve('app/ai-settings.tsx')).default; await settle();
      return async () => { inSettings = false; slots = previous.slots; screen = previous.screen; effects = []; await settle(); };
    },
  };
}

test('generation proceeds from processing directly to the full report intro', async () => {
  const extraction = { summary: 'Business' };
  const f = fixture({ route: 'celebration', extraction });
  f.state.pendingOnboardingExtraction = null;
  f.state.onboardingContext = { answers: {} };
  f.render();
  f.find(n => n.type === 'ReportProcessing');
  await f.settle();
  assert.equal(f.state.pendingOnboardingExtraction, extraction);
  assert.deepEqual(f.calls, [['replace', '/onboarding-report-intro']]);
});

test('new intro navigates directly to the full report without a back action', async () => {
  const extraction = { summary: 'Business' };
  const intro = fixture({ route: 'onboarding-report-intro', extraction });
  await intro.settle();
  const screen = intro.find(n => n.type === 'ReportIntro');
  assert.equal(screen.props.onBack, undefined);
  screen.props.onExplore();
  assert.deepEqual(structuredClone(intro.calls), [['replace', { pathname: '/onboarding-summary', params: { view: 'full' } }]]);
});

test('report completion persists and refreshes before applying and resetting directly to chat', async () => {
  const extraction = { summary: 'Business' };
  const f = fixture({ route: 'onboarding-summary', view: 'full', extraction });
  await f.settle();
  await f.find(n => n.type === 'ReportDetail').props.onFinish();
  await f.settle();
  assert.deepEqual(f.calls.map(c => c[0]), ['save', 'complete', 'refresh', 'apply', 'reset']);
  assert.deepEqual(structuredClone(f.calls.at(-1)[1]), { index: 0, routes: [{ name: '(tabs)', params: { screen: 'chat' } }] });
  assert.equal(f.state.onboardingCompleted, true);
});

test('failed report completion preserves the report and allows retry without navigating', async () => {
  const extraction = { summary: 'Business' };
  const f = fixture({ route: 'onboarding-summary', view: 'full', extraction, failSave: true });
  await f.settle();
  await f.find(n => n.type === 'ReportDetail').props.onFinish();
  await f.settle();
  assert.equal(f.state.pendingOnboardingExtraction, extraction);
  assert.deepEqual(f.calls.map(c => c[0]), ['save']);
  await f.find(n => n.type === 'ReportDetail').props.onFinish();
  assert.equal(f.calls.length, 2);
});

test('background report routes cannot redirect when completion clears the pending result', async () => {
  for (const route of ['onboarding-report-intro', 'onboarding-summary']) {
    const f = fixture({ route, focused: false });
    await f.settle();
    assert.deepEqual(f.calls, []);
  }
});

test('repeated keyboard cycles lift conversation without resizing hero and restore its resting position', async () => {
  const f = fixture();
  await f.settle();
  await f.click('Vamos lá');
  const message = () => f.find(n => n.type === 'AnimatedView' && n.props.onLayout);
  const composer = () => f.find(n => n.type === 'View' && n.props.onLayout && Array.isArray(n.props.style));
  const hero = () => f.find(n => Array.isArray(n.props?.style) && n.props.style[0]?.backgroundColor === '#EAF8EE');
  message().props.onLayout({ nativeEvent: { layout: { height: 140 } } });
  composer().props.onLayout({ nativeEvent: { layout: { height: 80, y: 764 } } });
  await f.settle();
  const height = hero().props.style[1].height;
  for (let cycle = 0; cycle < 3; cycle++) {
    f.find(n => n.type === 'TextInput').props.onFocus();
    composer().props.onLayout({ nativeEvent: { layout: { height: 80, y: 400 } } });
    await f.keyboard('keyboardDidShow');
    assert.equal(hero().props.style[1].height, height);
    assert.ok(message().props.style[1].transform[0].translateY < 0);
    composer().props.onLayout({ nativeEvent: { layout: { height: 80, y: 764 } } });
    await f.keyboard('keyboardDidHide');
    assert.equal(hero().props.style[1].height, height);
    assert.equal(message().props.style[1].transform[0].translateY, 0);
  }
});

test('collection keeps seven stages, saves answers and explains IA without processing', async () => {
  const f = fixture(); const questions = await f.collect();
  assert.equal(questions.length + 1, 7);
  assert.equal(Object.keys(f.state.openAnswers).length, questions.length);
  assert.equal(f.calls.filter(c => c[0] === 'replace' || c[0] === 'testKey' || c[0] === 'complete').length, 0);
  assert.equal(f.nodes().filter(n => n.type === 'TextInput').length, 0);
  assert.ok(!f.text(f.nodes()).includes('Chave de IA'));
  const bubbles = f.nodes().filter(n => n.type === 'SpeechBubble');
  assert.equal(bubbles.length, 2); assert.equal(bubbles[1].props.delayMs, 1400);
  assert.match(bubbles[0].props.message.segments[0].text, /^Pronto!/);
  assert.match(bubbles[1].props.message.segments[0].text, /^Agora posso usar IA/);
  assert.deepEqual(f.records.at(-1).responses, f.state.openAnswers);
  assert.equal(f.state.onboardingCompleted, false);
  const progress = f.nodes().filter(n => Array.isArray(n.props?.style) && n.props.style[0]?.height === 8);
  assert.equal(progress.length, 7);
  assert.ok(progress.every(n => n.props.style[1]?.backgroundColor));
});

test('back restores stage seven and the previous answer', async () => {
  const f = fixture(); const questions = await f.collect(); const answers = { ...f.state.openAnswers };
  await f.back();
  assert.deepEqual(f.state.openAnswers, answers);
  assert.equal(f.find(n => n.type === 'TextInput').props.value, answers[questions.at(-1).id]);
});

test('skip requires custom confirmation; cancel stays; confirm completes without IA', async () => {
  const f = fixture(); await f.collect(); await f.click('Continuar sem IA');
  assert.ok(f.nodes().some(n => n.type === 'Modal'));
  assert.ok(f.text(f.nodes()).includes('Sem configurar a IA agora'));
  await f.click('Voltar e configurar');
  assert.equal(f.calls.filter(c => c[0] === 'complete').length, 0);
  await f.click('Continuar sem IA');
  // The footer and modal both have this label; select the modal's confirmation.
  await f.find(n => n.type === 'Modal').props.children.props.children[1].props.children.find(n => n?.props?.onPress && f.text(n) === 'Continuar sem IA').props.onPress();
  await f.settle();
  assert.equal(f.state.onboardingCompleted, true);
  assert.equal(f.calls.filter(c => c[0] === 'testKey').length, 0);
  assert.equal(f.records.at(-1).structuredProfile, undefined);
  assert.deepEqual(f.records.at(-1).responses, f.state.openAnswers);
  assert.ok(f.calls.some(c => c[1] === '/(tabs)/chat'));
});

test('configure uses existing settings; only valid key proceeds to existing processing', async () => {
  const f = fixture(); await f.collect(); await f.click('Configurar IA');
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls.at(-1))), ['push', { pathname: '/ai-settings', params: { from: 'onboarding' } }]);
  await f.settings(); await f.click('Testar conexão');
  assert.ok(!f.calls.some(c => c[0] === 'replace'));
  await f.click('Salvar e continuar');
  assert.ok(f.calls.some(c => c[1] === '/celebration'));
  const invalid = fixture({ keyValid: false }); await invalid.settings(); await invalid.click('Testar conexão');
  assert.ok(!invalid.calls.some(c => c[1] === '/celebration'));
});

test('settings opened later does not start onboarding personalization', async () => {
  const f = fixture({ from: '' }); await f.settings(); await f.click('Testar conexão');
  assert.ok(!f.calls.some(c => c[0] === 'replace'));
});

test('canceling key settings returns to explanation with all answers intact', async () => {
  const f = fixture(); await f.collect(); const answers = { ...f.state.openAnswers };
  await f.click('Configurar IA'); const restore = await f.settings();
  f.find(n => n.type === 'AccountHeader').props.onBack(); await restore();
  assert.deepEqual(f.state.openAnswers, answers);
  assert.equal(f.nodes().filter(n => n.type === 'SpeechBubble').length, 2);
  assert.equal(f.nodes().filter(n => n.type === 'TextInput').length, 0);
  assert.ok(!f.calls.some(c => c[1] === '/celebration'));
});

test('failed persistence retains answers and blocks navigation', async () => {
  const f = fixture({ failSave: true }); await f.collect(); await f.click('Configurar IA');
  assert.ok(f.text(f.nodes()).includes('Não consegui salvar'));
  assert.equal(f.calls.filter(c => c[0] === 'push' || c[0] === 'complete').length, 0);
  assert.equal(Object.keys(f.state.openAnswers).length, 6);
});

test('configured backend status continues to personalization without asking for another key', async () => {
  const f = fixture({ configured: true }); await f.collect();
  await f.click('Personalizar meu Lumio');
  assert.deepEqual(f.calls.at(-1), ['replace', '/celebration']);
  assert.deepEqual(f.records.at(-1).responses, f.state.openAnswers);
  assert.ok(!f.calls.some(c => c[1]?.pathname === '/ai-settings'));
});

test('status lookup error is displayed and blocks the IA action instead of claiming a key exists', async () => {
  const f = fixture({ statusError: true }); await f.collect();
  assert.ok(f.text(f.nodes()).includes('Falha ao consultar IA.'));
  assert.equal(f.find(n => n.props?.onPress && f.text(n) === 'Configurar IA').props.disabled, true);
  assert.equal(f.calls.filter(c => c[0] === 'push').length, 0);
});

test('draft test stays in settings until saved; saving clears the secret field', async () => {
  const f = fixture(); await f.settings();
  f.find(n => n.type === 'TextInput').props.onChangeText('test-only-key-entered-in-form'); await f.settle();
  await f.click('Testar conexão');
  assert.ok(!f.calls.some(c => c[1] === '/celebration'));
  await f.click('Salvar e continuar');
  const input = f.find(n => n.type === 'TextInput');
  assert.equal(input.props.value, ''); assert.equal(input.props.autoComplete, 'off');
  assert.ok(f.calls.some(c => c[0] === 'saveKey' && c[1] === 'test-user'));
});

test('new key is tested without persistence, then saved before navigating directly to generation', async () => {
  const f = fixture({ settingsConfigured: false }); await f.settings();
  f.find(n => n.type === 'TextInput').props.onChangeText('temporary-key-entered-in-form'); await f.settle();
  await f.click('Testar conexão');
  assert.ok(f.text(f.nodes()).includes('Conexão realizada com sucesso!'));
  assert.deepEqual(f.calls, [['testKey']]);
  await f.click('Salvar e continuar');
  assert.deepEqual(f.calls, [['testKey'], ['saveKey', 'test-user'], ['replace', '/celebration']]);
});

test('resources save returns with confirmation and never starts generation', async () => {
  const f = fixture({ from: 'resources' }); await f.settings();
  f.find(n => n.type === 'TextInput').props.onChangeText('temporary-key-entered-in-form'); await f.settle();
  await f.click('Testar conexão'); await f.click('Salvar chave');
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls.at(-1))), ['dismissTo', { pathname: '/resources', params: { aiKeySaved: '1' } }]);
  assert.equal(f.calls.filter(c => c[0] === 'replace').length, 0);
});

test('editing a validated key requires a fresh test before saving', async () => {
  const f = fixture(); await f.settings(); await f.click('Testar conexão');
  f.find(n => n.type === 'TextInput').props.onChangeText('different-key-entered-in-form'); await f.settle();
  assert.ok(!f.nodes().some(n => n.props?.onPress && f.text(n) === 'Salvar e continuar'));
  assert.ok(!f.text(f.nodes()).includes('Conexão realizada com sucesso!'));
});

test('failed key save preserves draft and validation without navigation', async () => {
  const f = fixture({ keySaveFails: true }); await f.settings();
  f.find(n => n.type === 'TextInput').props.onChangeText('temporary-key-entered-in-form'); await f.settle();
  await f.click('Testar conexão'); await f.click('Salvar e continuar');
  assert.equal(f.find(n => n.type === 'TextInput').props.value, 'temporary-key-entered-in-form');
  assert.ok(f.nodes().some(n => n.props?.onPress && f.text(n) === 'Salvar e continuar'));
  assert.equal(f.calls.filter(c => c[0] === 'replace' || c[0] === 'back').length, 0);
});

test('repeated taps cannot duplicate testing, saving or navigation', async () => {
  let finishTest, finishSave;
  const f = fixture({ testPending: new Promise(r => { finishTest = r; }), savePending: new Promise(r => { finishSave = r; }) });
  await f.settings();
  f.find(n => n.type === 'TextInput').props.onChangeText('temporary-key-entered-in-form'); await f.settle();
  const testKey = f.find(n => n.props?.onPress && f.text(n) === 'Testar conexão').props.onPress;
  const testing = testKey(); await testKey();
  assert.equal(f.calls.filter(c => c[0] === 'testKey').length, 1);
  finishTest(); await testing; await f.settle();
  const saveKey = f.find(n => n.props?.onPress && f.text(n) === 'Salvar e continuar').props.onPress;
  const saving = saveKey(); await saveKey();
  assert.equal(f.calls.filter(c => c[0] === 'saveKey').length, 1);
  finishSave(); await saving; await saveKey(); await f.settle();
  assert.equal(f.calls.filter(c => c[0] === 'replace').length, 1);
});

test('leaving during a pending save prevents late navigation', async () => {
  let finishSave;
  const f = fixture({ savePending: new Promise(r => { finishSave = r; }) }); await f.settings();
  f.find(n => n.type === 'TextInput').props.onChangeText('temporary-key-entered-in-form'); await f.settle();
  await f.click('Testar conexão');
  const saving = f.find(n => n.props?.onPress && f.text(n) === 'Salvar e continuar').props.onPress();
  f.find(n => n.type === 'AccountHeader').props.onBack();
  finishSave(); await saving; await f.settle();
  assert.equal(f.find(n => n.type === 'TextInput').props.value, '');
  assert.equal(f.calls.filter(c => c[0] === 'replace').length, 0);
});

test('Android masked key edits retain the actual key across typing, paste, selection and deletion', () => {
  const source = fs.readFileSync('src/components/api-key-input.tsx', 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: name => name === 'react' ? { useRef: () => ({ current: { start: 3, end: 3 } }) } : name === 'react/jsx-runtime' ? { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) } : { Platform: { OS: 'android' }, TextInput: 'TextInput', View: 'View', Text: 'Text', StyleSheet: { flatten: value => value } } });
  const edit = module.exports.applyMaskedEdit;
  assert.equal(edit('abc', '•••d', { start: 3, end: 3 }), 'abcd');
  assert.equal(edit('abc', '•XYZ••', { start: 1, end: 1 }), 'aXYZbc');
  assert.equal(edit('abcdef', '••XYZ•', { start: 2, end: 5 }), 'abXYZf');
  assert.equal(edit('abcdef', '•••', { start: 2, end: 5 }), 'abf');
  assert.equal(edit('abc', '••', { start: 2, end: 2 }), 'ac');
  assert.equal(edit('abc', 'pasted-key', { start: 0, end: 3 }), 'pasted-key');
  const component = module.exports.default({ value: 'actual-secret', onChangeText() {}, style: { color: 'black' } });
  const native = component.props.children[0];
  assert.equal(native.props.secureTextEntry, false);
  assert.equal(native.props.value, '•'.repeat(13));
  assert.equal(native.props.style.at(-1).color, 'transparent');
  assert.equal(native.props.autoComplete, 'off');
  assert.equal(native.props.importantForAutofill, 'noExcludeDescendants');
});
