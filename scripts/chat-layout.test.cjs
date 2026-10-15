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

function scrollFixture() {
  const frames = [];
  const metrics = { viewport: 0, content: 0, offset: 0, calls: 0 };
  const context = {
    useCallback: fn => fn, followContentResize: { current: true }, scrollFrame: { current: null },
    requestAnimationFrame: fn => { frames.push(fn); return frames.length; },
    flatListRef: { current: { scrollToEnd() { metrics.offset = Math.max(0, metrics.content - metrics.viewport); metrics.calls++; } } },
  };
  const names = ['scrollToBottom', 'preserveCardReading', 'handleContentResize'];
  const declarations = names.map(name => screen.body.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === name)).getText(ast)).join('\n');
  vm.runInNewContext(compile(declarations + '\nglobalThis.handlers = {scrollToBottom, preserveCardReading, handleContentResize};'), context);
  return { ...context.handlers, metrics, frames, paint() { frames.splice(0).forEach(fn => fn()); } };
}

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
    assert.equal(f.frames.length, 1, 'layout changes coalesce in the next frame');
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
