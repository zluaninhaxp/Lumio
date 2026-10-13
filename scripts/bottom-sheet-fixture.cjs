const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture({ reducedMotion = false, deferClose = false, deferCancel = false } = {}) {
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
  const animations = [], values = [];
  let pending = null, cancelled = null;
  const animation = (kind, value, config) => {
    animations.push({ kind, config });
    return { value, config, start: callback => { value.setValue(config.toValue); callback?.({ finished: true }); } };
  };
  const native = {
    Platform: { OS: 'android' }, Dimensions: { get: () => ({ height: 844 }) },
    useWindowDimensions: () => ({ height: 844, width: 390 }),
    StyleSheet: { create: value => value, absoluteFillObject: {} },
    Keyboard: { metrics: () => undefined, isVisible: () => keyboard, dismiss: () => { keyboard = false; }, addListener: () => ({ remove() {} }) },
    Animated: { Value: class {
      constructor(value) { this.value = value; values.push(this); }
      setValue(value) { this.value = value; }
      stopAnimation() { if (pending) {
        const callback = pending; pending = null;
        if (deferCancel) cancelled = callback;
        else callback({ finished: false });
      } }
    }, parallel: children => ({ start(callback) {
      children.forEach(child => child.start());
      if (deferClose && children.some(child => child.config.toValue === 0 && child.config.duration === 220)) pending = callback;
      else callback?.({ finished: true });
    } }), spring: (value, config) => animation('spring', value, config), timing: (value, config) => animation('timing', value, config), View: 'AnimatedView' },
    PanResponder: { create: handlers => ({ panHandlers: handlers }) },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('app/components/Calendar/BottomSheet.tsx', 'utf8') + '\nexport { BottomSheetContent };', { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require(name) {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === 'react-native') return native;
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }) };
    if (name.endsWith('/bottomSheetLayout')) return { isBottomKeyboard: () => false, getBottomSheetLayout: () => ({ minHeight: 0, maxHeight: 796, paddingBottom: 56 }) };
    if (name.endsWith('/sheet-draft')) return { SheetDraftContext: { Provider: 'DraftProvider' } };
    if (name.endsWith('/appAlert')) return { AppAlert: { alert: (...args) => alerts.push(args) } };
    if (name.endsWith('/use-system-reduced-motion')) return { useSystemReducedMotion: () => reducedMotion };
    return { Colors: {}, Radius: {}, Spacing: {}, SurfaceStyles: {} };
  } });
  function nodes(node) { return !node ? [] : Array.isArray(node) ? node.flatMap(nodes) : typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []; }
  let props = { visible: true, draft: { name: '' }, onClose: () => { closed++; }, modalRef, children: null };
  return {
    ref, modalRef, alerts, animations, values,
    setReducedMotion(value) { reducedMotion = value; },
    finishAnimation() { const callback = pending; pending = null; callback?.({ finished: true }); },
    finishCancelledAnimation() { const callback = cancelled; cancelled = null; callback?.({ finished: false }); },
    get closed() { return closed; },
    openKeyboard() { keyboard = true; },
    get keyboard() { return keyboard; },
    render(changes = {}) { props = { ...props, ...changes }; cursor = 0; const tree = module.exports.BottomSheetContent(props, ref); effects.splice(0).forEach(effect => effect()); return nodes(tree); },
  };
}

module.exports = { fixture };
