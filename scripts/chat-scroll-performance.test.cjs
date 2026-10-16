const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(reducedMotion = false) {
  const native = { height: 600, content: 0, offset: 0, calls: [] };
  const progress = { value: 0 }, controllerRef = { current: null };
  let prepare, react, previous = null;
  const jsx = (type, props) => ({ type, props });
  const stubs = {
    react: { forwardRef: fn => fn, useCallback: fn => fn, useEffect: fn => fn(), useImperativeHandle: (ref, fn) => { if (ref) ref.current = fn(); } },
    'react/jsx-runtime': { jsx },
    'react-native': { Platform: { OS: 'android' }, StyleSheet: { hairlineWidth: 0.5 }, FlatList: 'FlatList' },
    'react-native-keyboard-controller': { useReanimatedKeyboardAnimation: () => ({ progress }) },
    'react-native-reanimated': {
      default: { createAnimatedComponent: () => 'Animated.FlatList' },
      useAnimatedRef: () => ({ current: native }), useSharedValue: value => ({ value }),
      useReducedMotion: () => reducedMotion,
      useAnimatedReaction: (a, b) => { prepare = a; react = b; },
      useAnimatedScrollHandler: handlers => handlers,
      measure: () => ({ height: native.height }),
      scrollTo: (_ref, _x, y, animated) => { native.offset = y; native.calls.push({ y, animated }); },
      dispatchCommand: (_ref, name, [animated]) => {
        assert.equal(name, 'scrollToEnd');
        native.offset = Math.max(0, native.content - native.height);
        native.calls.push({ y: native.offset, animated });
      },
    },
  };
  const module = { exports: {} };
  const source = fs.readFileSync('src/components/chat/chat-message-list.tsx', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module, exports: module.exports, require: name => { assert.ok(name in stubs, name); return stubs[name]; },
      requestAnimationFrame: () => assert.fail('Android motion must not wait for the JS frame queue') });
  const android = module.exports.ChatMessageList({ controllerRef }, {});
  const list = android.type(android.props, {});
  const flush = () => { const current = prepare(); react(current, previous); previous = current; };
  const content = (height, logical = true, nativeHeight = height) => {
    native.content = nativeHeight;
    if (logical) controllerRef.current.contentDidLayout(400, height);
    list.props.onContentSizeChange(400, height); flush();
  };
  const keyboard = (value, height) => { progress.value = value; native.height = height; flush(); };
  return { native, list: list.props, controller: controllerRef.current, content, keyboard, flush };
}

test('opening follows actual native viewport on every IME frame without JS layout delivery', () => {
  const f = fixture(); f.content(2400);
  for (const [progress, height] of [[0.1, 580], [0.3, 510], [0.7, 400], [1, 300]]) {
    f.keyboard(progress, height);
    assert.equal(f.native.offset, 2400 - height);
    assert.equal(f.native.calls.at(-1).animated, false, 'no competing scroll animation during keyboard movement');
  }
  const count = f.native.calls.length;
  f.flush(); f.content(2400); f.flush();
  assert.equal(f.native.calls.length, count, 'duplicate native geometry produces no scroll command');
});

test('message/footer/card growth uses native smooth scroll to complete content including trailing clearance', () => {
  const f = fixture(); f.content(2400); f.keyboard(1, 300);
  f.content(2800);
  assert.deepEqual(f.native.calls.at(-1), { y: 2500, animated: true });
  const count = f.native.calls.length;
  f.content(2800); f.flush(); assert.equal(f.native.calls.length, count);
  f.content(2940); assert.equal(f.native.offset, 2640);
  const accessible = fixture(true); accessible.content(1000); accessible.content(1300);
  assert.equal(accessible.native.calls.at(-1).animated, false);
});

test('closing preserves native range clamping and only reconciles at final geometry', () => {
  const f = fixture(); f.content(2400); f.keyboard(1, 300);
  const count = f.native.calls.length;
  f.keyboard(0.7, 400); f.keyboard(0.4, 500);
  assert.equal(f.native.calls.length, count, 'do not change the existing closing animation');
  f.keyboard(0, 600);
  assert.deepEqual(f.native.calls.at(-1), { y: 1800, animated: false });
});

test('late duplicate/obsolete content events after closing cannot animate or scroll to an obsolete boundary', () => {
  const f = fixture(); f.content(2400); f.keyboard(1, 300); f.keyboard(0, 600);
  assert.equal(f.list.maintainVisibleContentPosition.minIndexForVisible, 0, 'native cells stay anchored as virtual spacers change');
  const settled = f.native.calls.length;
  f.controller.contentDidLayout(400, 2400); f.flush(); // duplicate real row measurement
  f.content(2352, false, 2400); // reported old spacer size; actual native content unchanged
  f.content(2400, false, 2400);
  assert.equal(f.native.offset, 1800, 'the already-correct native end never moves down by 48');
  for (const command of f.native.calls.slice(settled)) {
    assert.equal(command.y, 1800);
    assert.equal(command.animated, false, 'no second animation after IME dismissal');
  }
  const count = f.native.calls.length;
  f.content(2400, false); f.flush();
  assert.equal(f.native.calls.length, count, 'identical content events are idempotent');
});

test('native programmatic momentum cannot be mistaken for a reader drag and cancel its own animation', () => {
  const f = fixture(); f.content(2400); f.keyboard(1, 300); f.content(2800);
  f.list.onScroll.onMomentumBegin();
  f.list.onScroll.onScroll({ contentOffset: { y: 2200 }, layoutMeasurement: { height: 300 }, contentSize: { height: 2800 } });
  f.flush(); f.list.onScroll.onMomentumEnd();
  f.content(3000);
  assert.deepEqual(f.native.calls.at(-1), { y: 2700, animated: true });
});

test('history reading and card expansion cancel following; own send resumes at the real end', () => {
  const f = fixture(); f.content(2400);
  f.list.onScroll.onBeginDrag();
  f.list.onScroll.onScroll({ contentOffset: { y: 400 }, layoutMeasurement: { height: 600 }, contentSize: { height: 2400 } });
  f.flush(); f.list.onScroll.onEndDrag();
  const count = f.native.calls.length;
  f.content(3200); f.keyboard(1, 300); f.flush();
  assert.equal(f.native.calls.length, count);
  f.controller.followToEnd(); f.flush();
  assert.equal(f.native.offset, 2900);
  f.controller.stopFollowing(); f.flush();
  const stopped = f.native.calls.length;
  f.content(3600); assert.equal(f.native.calls.length, stopped);
});
