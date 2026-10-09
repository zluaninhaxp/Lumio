const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture() {
  const slots = []; let cursor = 0, keyboard = false, closed = 0;
  const alerts = [], effects = [], ref = { current: null }, modalRef = { current: null };
  const hooks = {
    forwardRef: callback => callback,
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = value; }]; },
    useMemo(callback, deps) { const i = cursor++; if (!slots[i] || deps.some((v, j) => v !== slots[i].deps[j])) slots[i] = { value: callback(), deps }; return slots[i].value; },
    useCallback(callback, deps) { return hooks.useMemo(() => callback, deps); },
    useEffect(callback, deps) { const i = cursor++; if (!slots[i] || deps.some((v, j) => v !== slots[i][j])) effects.push(callback); slots[i] = deps; },
    useImperativeHandle(target, callback) { target.current = callback(); },
  };
  const animation = () => ({ start: callback => callback?.({ finished: true }) });
  const native = {
    Platform: { OS: 'android' }, Dimensions: { get: () => ({ height: 844 }) },
    useWindowDimensions: () => ({ height: 844, width: 390 }),
    StyleSheet: { create: value => value, absoluteFillObject: {} },
    Keyboard: { metrics: () => undefined, isVisible: () => keyboard, dismiss: () => { keyboard = false; }, addListener: () => ({ remove() {} }) },
    Animated: { Value: class { setValue() {} }, parallel: animation, spring: animation, timing: animation, View: 'AnimatedView' },
    PanResponder: { create: handlers => ({ panHandlers: handlers }) },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('app/components/Calendar/BottomSheet.tsx', 'utf8') + '\nexport { BottomSheetContent };', { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require(name) {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === 'react-native') return native;
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }) };
    if (name.endsWith('/bottomSheetLayout')) return { isBottomKeyboard: () => false, getBottomSheetLayout: () => ({ minHeight: 0, maxHeight: 796, paddingBottom: 56 }) };
    if (name.endsWith('/sheet-draft')) return { SheetDraftContext: { Provider: 'DraftProvider' } };
    if (name.endsWith('/appAlert')) return { AppAlert: { alert: (...args) => alerts.push(args) } };
    return { Colors: {}, Radius: {}, Spacing: {}, SurfaceStyles: {} };
  } });
  function nodes(node) { return !node ? [] : Array.isArray(node) ? node.flatMap(nodes) : typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []; }
  let props = { visible: true, draft: { name: '' }, onClose: () => { closed++; }, modalRef, children: null };
  return {
    ref, modalRef, alerts,
    get closed() { return closed; },
    openKeyboard() { keyboard = true; },
    get keyboard() { return keyboard; },
    render(changes = {}) { props = { ...props, ...changes }; cursor = 0; const tree = module.exports.BottomSheetContent(props, ref); effects.splice(0).forEach(effect => effect()); return nodes(tree); },
  };
}

test('first Android Back hides the keyboard without dismissing or confirming; second Back protects the draft', () => {
  const app = fixture(); app.render(); app.render({ draft: { name: 'Rascunho' } }); app.openKeyboard();
  app.modalRef.current.requestClose(); assert.equal(app.keyboard, false); assert.equal(app.closed, 0); assert.equal(app.alerts.length, 0);
  app.modalRef.current.requestClose(); assert.equal(app.closed, 0); assert.equal(app.alerts.length, 1);
});
test('cancel confirmation keeps values and repeated close cannot duplicate the dialog', () => {
  const app = fixture(); app.render(); app.render({ draft: { name: 'Rascunho' } });
  app.ref.current.requestClose(); app.ref.current.requestClose(); assert.equal(app.alerts.length, 1);
  app.alerts[0][2][0].onPress(); assert.equal(app.closed, 0);
  app.ref.current.requestClose(); assert.equal(app.alerts.length, 2);
  app.alerts[1][2][1].onPress(); assert.equal(app.closed, 1);
});
test('completed save bypasses confirmation; unchanged and reverted forms dismiss normally', () => {
  const saved = fixture(); saved.render(); saved.render({ draft: { name: 'Salvo' } }); saved.ref.current.close(); assert.equal(saved.closed, 1); assert.equal(saved.alerts.length, 0);
  const unchanged = fixture(); unchanged.render(); unchanged.ref.current.requestClose(); assert.equal(unchanged.closed, 1);
  const reverted = fixture(); reverted.render(); reverted.render({ draft: { name: 'Texto' } }); reverted.render({ draft: { name: '' } }); reverted.ref.current.requestClose(); assert.equal(reverted.closed, 1); assert.equal(reverted.alerts.length, 0);
});
test('registered inner form changes are protected too, while loading prevents dismissal', () => {
  const app = fixture(); const provider = app.render().find(node => node.type === 'DraftProvider');
  provider.props.value.drafts.set({}, { initial: '', current: 'Texto' }); app.ref.current.requestClose(); assert.equal(app.alerts.length, 1);
  const loading = fixture(); loading.render({ dismissible: false }); loading.ref.current.requestClose(); assert.equal(loading.closed, 0); assert.equal(loading.alerts.length, 0);
});
test('an old discard confirmation cannot close a reopened form', () => {
  const app = fixture(); app.render(); app.render({ draft: { name: 'Antigo' } }); app.ref.current.requestClose();
  app.render({ visible: false }); app.render({ visible: true, draft: { name: 'Novo' } }); app.alerts[0][2][1].onPress(); assert.equal(app.closed, 0);
});