const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('app/(tabs)/chat.tsx', 'utf8');
const ast = ts.createSourceFile('chat.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const screen = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'ChatScreen');
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;

function surface(organicEdge = true) {
  const changes = [], effects = [], module = { exports: {} };
  const stubs = {
    react: { useEffect: fn => effects.push(fn) },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { View: 'View', StyleSheet: { create: s => s } },
    'react-native-svg': { default: 'Svg', Path: 'Path' },
    '../constants/theme': { Colors: {} },
  };
  vm.runInNewContext(compile(fs.readFileSync('src/components/bottom-surface.tsx', 'utf8')), { module, exports: module.exports, require: name => stubs[name] });
  const tree = module.exports.BottomSurface({ organicEdge, onTopOverlapChange: height => changes.push(height) });
  effects.forEach(fn => fn());
  return { changes, edge: tree.props.children[0] };
}

test('surface reports the measured decorative overlap without changing its appearance', () => {
  const f = surface();
  for (const [y, height, expected] of [[-24, 32, 24], [-31, 40, 31], [0, 32, 0], [5, 32, 0], [-60, 40, 40]]) {
    f.edge.props.onLayout({ nativeEvent: { layout: { y, height } } });
    assert.equal(f.changes.at(-1), expected);
  }
  assert.equal(f.edge.props.style.top, -24);
  assert.equal(f.edge.props.style.height, 32);
  assert.equal(surface(false).changes.at(-1), 0, 'command panel removes the edge clearance');
});

const scrollFixture = require('./helpers/chat-scroll-fixture.cjs');

test('short/long messages and cards end above the measured edge across keyboard and Android inset changes', () => {
  const styleDeclaration = ast.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === 'styles')).getText(ast);
  const context = { StyleSheet: { create: s => s }, Colors: {}, Spacing: { md: 16 }, Radius: {}, FontSize: {}, SurfaceStyles: {} };
  vm.runInNewContext(compile(styleDeclaration + '\nglobalThis.result = styles;'), context);
  assert.equal(context.result.readingArea.flex, 1);
  assert.equal(context.result.inputBar.flexShrink, 0);
  assert.match(source, /paddingBottom: composerTopOverlap \+ Spacing.md/);
  assert.match(source, /onTopOverlapChange=\{setComposerTopOverlap\}/);
  // Navigation and system inset are already outside the Chat scene; resize gives
  // the actual remaining viewport. Exercise each transition on the same reader.
  const f = scrollFixture();
  for (const inset of [0, 16, 24, 48]) for (const keyboard of [0, 300, 0]) for (const composer of [76, 140]) for (const messageHeight of [42, 1800, 620]) {
    const edge = 24, gap = 16, tabHeight = keyboard ? 0 : 56 + inset;
    const sceneHeight = 844 - 32 - 64 - tabHeight - keyboard;
    f.metrics.viewport = sceneHeight - composer;
    const padding = edge + gap;
    f.metrics.content = 1200 + messageHeight + padding;
    f.handleContentResize(); f.handleContentResize();
    assert.equal(f.frames.size, 1, 'layout changes coalesce in the next frame');
    f.paint();
    const messageBottom = f.metrics.content - padding - f.metrics.offset;
    assert.equal(f.metrics.viewport - edge - messageBottom, gap);
  }
});

test('reading history cancels pending follow; growth and keyboard changes do not pull the reader down', () => {
  const f = scrollFixture();
  f.metrics.content = 2400; f.metrics.viewport = 600;
  f.handleContentResize(); f.preserveCardReading(); f.paint();
  assert.equal(f.metrics.calls, 0);
  f.metrics.viewport = 300; f.metrics.content = 4000;
  f.handleContentResize(); f.paint();
  assert.equal(f.metrics.calls, 0);
  f.scrollToBottom(); f.paint();
  assert.equal(f.metrics.offset, 3700, 'explicit own send resumes following');
  assert.match(source, /measureInWindow\([\s\S]*?setKeyboardVerticalOffset\(y \+ height\)/);
  assert.match(source, /onContentSizeChange=\{handleContentResize\}/);
  assert.match(source, /onLayout=\{handleContentResize\}/);
});

test('regression: installed VirtualizedList stops before trailing padding even with a measured last cell', () => {
  const installed = fs.readFileSync('node_modules/react-native/node_modules/@react-native/virtualized-lists/Lists/VirtualizedList.js', 'utf8');
  const start = installed.indexOf('    const animated = params ? params.animated : true;', installed.indexOf('// scrollToEnd'));
  assert.ok(start >= 0);
  const body = installed.slice(start, installed.indexOf('\n  }', start));
  const oldScroll = vm.runInNewContext('(function(params) {\n' + body + '\n})');
  let oldOffset;
  oldScroll.call({
    props: { data: ['last'], getItemCount: data => data.length },
    _listMetrics: { getCellMetricsApprox: () => ({ offset: 500, length: 1000 }) },
    _footerLength: 0, _scrollMetrics: { visibleLength: 600 },
    scrollToOffset: options => { oldOffset = options.offset; },
  }, { animated: false });
  const f = scrollFixture();
  f.metrics.content = 1540; f.metrics.viewport = 600;
  f.handleContentResize(); f.paint();
  assert.equal(oldOffset, 900);
  assert.equal(f.metrics.offset, 940, 'same boundary as manual/native scroll, including the existing 40px clearance');
});

test('late wrapping suggestions and long card layouts invalidate pending scroll until the final layout frame', () => {
  const f = scrollFixture();
  f.scrollToBottom(); assert.equal(f.metrics.calls, 0);
  f.paintFrame(); assert.equal(f.metrics.calls, 0);
  for (const height of [900, 1140, 1248, 2600]) {
    f.metrics.content = height;
    f.handleContentResize(); f.paintFrame();
    assert.equal(f.metrics.calls, 0, 'layout changes restart the native frame barrier');
  }
  f.paintFrame();
  assert.equal(f.metrics.calls, 1);
  assert.equal(f.metrics.offset, 2000);
  assert.equal(f.frames.size, 0, 'no ongoing polling or fixed-delay scroll loop');
  f.metrics.content = 90;
  f.handleContentResize(); f.paint();
  assert.equal(f.metrics.offset, 0, 'short content cannot create an overscroll gap');
});

test('keyboard events only manage the menu; actual viewport changes own scroll and preserve history', () => {
  const effect = screen.body.statements.find(n => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) && n.expression.expression.getText(ast) === 'useEffect' && n.expression.arguments[0].getText(ast).includes("'keyboardDidShow'"));
  const callbacks = new Map();
  const f = scrollFixture();
  const cleanup = f.evaluate('(' + effect.expression.arguments[0].getText(ast) + ')();', {
    Keyboard: { addListener(name, fn) { callbacks.set(name, fn); return { remove: () => callbacks.delete(name) }; } },
    setKeyboardVisible() {}, setCommandMenuDismissed() {},
  });
  callbacks.get('keyboardDidShow')(); f.paintFrame();
  assert.equal(f.metrics.calls, 0, 'keyboard event must not schedule a competing scroll');
  assert.equal(callbacks.has('keyboardDidChangeFrame'), false);
  f.metrics.viewport = 280; f.handleContentResize(); f.paint();
  assert.equal(f.metrics.offset, 2120);
  f.metrics.viewport = 320; f.handleContentResize(); f.paint();
  assert.equal(f.metrics.offset, 2080);
  callbacks.get('keyboardDidHide')(); f.paintFrame();
  f.metrics.viewport = 600; f.handleContentResize(); f.paint();
  assert.equal(f.metrics.offset, 1800);
  f.preserveCardReading(); f.metrics.offset = 500;
  callbacks.get('keyboardDidShow')(); f.metrics.viewport = 280; f.handleContentResize(); f.paint();
  assert.equal(f.metrics.offset, 500);
  cleanup(); assert.equal(callbacks.size, 0);
});

test('Android uses native resize without a second keyboard avoidance or delayed tab restoration', () => {
  const config = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  assert.equal(config.expo.android.softwareKeyboardLayoutMode, 'resize');
  assert.match(source, /enabled=\{Platform.OS === 'ios'\}/);
  assert.doesNotMatch(source, /setKeyboardVisible|keyboardDidChangeFrame/);
  const tabs = fs.readFileSync('app/(tabs)/_layout.tsx', 'utf8');
  assert.match(tabs, /tabBarHideOnKeyboard: Platform.OS !== 'android' \|\| route.name !== 'chat'/);
  const viewport = fs.readFileSync('src/components/chat/chat-keyboard-layout.tsx', 'utf8');
  assert.match(viewport, /useReanimatedKeyboardAnimation/);
  assert.match(viewport, /height: height \* visible/);
  assert.match(viewport, /setEnabled\(active\)/);
  assert.doesNotMatch(viewport, /withTiming|setTimeout|Keyboard.addListener/);
});

test('Chat tab height follows each native IME frame and releases all navigation inset while open', () => {
  const file = fs.readFileSync('src/components/chat/chat-keyboard-layout.tsx', 'utf8');
  const tree = ts.createSourceFile('layout.tsx', file, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'AndroidChatTabBar');
  for (const height of [56, 72, 104]) for (const progress of [0, 0.25, 0.5, 0.75, 1, 0.5, 0]) {
    const module = { exports: {} };
    const context = {
      module, exports: module.exports,
      require: () => ({ jsx: (type, props) => ({ type, props }) }),
      useReanimatedKeyboardAnimation: () => ({ progress: { value: progress } }),
      useAnimatedStyle: fn => fn(), Animated: { View: 'Animated.View' }, View: 'View', BottomTabBar: 'BottomTabBar',
    };
    vm.runInNewContext(compile(fn.getText(tree) + '\nglobalThis.render = AndroidChatTabBar;'), context);
    const props = { state: { index: 0, routes: [{ name: 'chat', key: 'chat' }] }, descriptors: { chat: { options: { tabBarStyle: { height } } } } };
    const result = context.render(props);
    assert.equal(result.props.style.height, height * (1 - progress));
    assert.equal(result.props.children.props.style.height, height, 'inner native tabs keep their resting geometry');
    props.state.routes[0].name = 'tarefas';
    assert.equal(Object.keys(context.render(props).props.style).length, 0, 'other screens retain navigator keyboard behavior');
  }
});

test('reader drag interrupts a pending native scroll; rapid own sends resume once layout settles', () => {
  const f = scrollFixture();
  f.handleContentResize(); f.paintFrame();
  f.context.dragging.current = true; f.preserveCardReading(); f.paint();
  f.handleContentResize(); assert.equal(f.frames.size, 0);
  assert.equal(f.metrics.calls, 0);
  f.context.dragging.current = false;
  for (let i = 0; i < 4; i++) { f.metrics.content += 120; f.scrollToBottom(); }
  f.paint();
  assert.equal(f.metrics.calls, 1);
  assert.equal(f.metrics.offset, f.metrics.content - f.metrics.viewport);
});

test('reading even a small distance above the bottom does not get snapped back by new content', () => {
  let onScroll;
  function walk(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'onScroll') onScroll = node.initializer.expression.getText(ast);
    ts.forEachChild(node, walk);
  }
  walk(screen); assert.ok(onScroll);
  const f = scrollFixture(); f.context.dragging.current = true;
  f.evaluate('(' + onScroll + ')(event);', {
    StyleSheet: { hairlineWidth: 0.5 },
    event: { nativeEvent: { contentSize: { height: 2400 }, contentOffset: { y: 1760 }, layoutMeasurement: { height: 600 } } },
  });
  f.context.dragging.current = false;
  f.metrics.offset = 1760; f.metrics.content += 400;
  f.handleContentResize(); f.paint();
  assert.equal(f.metrics.calls, 0);
  assert.equal(f.metrics.offset, 1760);
  f.scrollToBottom(); f.paint();
  assert.equal(f.metrics.offset, 2200);
});
