const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(reducedMotion = false) {
  const effects = [], animations = [], calls = [];
  let phase = 0;
  const progress = { get: () => phase, set: value => calls.push(value) };
  const jsx = (type, props) => typeof type === 'function' ? type(props) : ({ type, props });
  const stubs = {
    react: { useEffect: fn => effects.push(fn) },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', StyleSheet: { create: value => value } },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView' },
      useSharedValue: () => progress, useReducedMotion: () => reducedMotion,
      useAnimatedStyle: fn => { animations.push(fn); return {}; },
      withTiming: (to, config) => ({ to, config }), withRepeat: (animation, count) => ({ animation, count }),
      cancelAnimation: value => calls.push({ cancelled: value }), Easing: { linear: 'linear' },
    },
    '../../constants/theme': { Colors: { textSecondary: '#6B6B6B' }, Spacing: { xs: 4 } },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/chat/TypingIndicator.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: name => { assert.ok(name in stubs, name); return stubs[name]; } });
  const tree = module.exports.TypingIndicator();
  const cleanups = effects.map(fn => fn());
  return { tree, calls, progress, sample(value) { phase = value; return animations.map(fn => fn()); }, unmount() { cleanups.forEach(fn => fn?.()); } };
}

test('three typing dots animate in sequence on the UI thread with accessible feedback', () => {
  const f = fixture();
  assert.equal(f.tree.props.children.length, 3);
  assert.equal(f.tree.props.accessibilityLabel, 'Lumio está digitando');
  assert.equal(f.tree.props.accessibilityLiveRegion, 'polite');
  assert.equal(f.calls[0].count, -1);
  assert.equal(f.calls[0].animation.config.easing, 'linear');
  const first = f.sample(0), later = f.sample(0.25);
  assert.notEqual(first[0].opacity, later[0].opacity);
  assert.notEqual(first[0].opacity, first[1].opacity);
  for (const dot of later) {
    assert.ok(dot.opacity >= 0.35 && dot.opacity <= 1);
    assert.ok(Math.abs(dot.transform[0].translateY) <= 2);
  }
  f.unmount(); assert.equal(f.calls.at(-1).cancelled, f.progress);
});

test('reduced motion keeps three visible dots without a loop or movement', () => {
  const f = fixture(true);
  assert.equal(f.tree.props.children.length, 3);
  assert.equal(f.calls.length, 0);
  for (const dot of f.sample(0.5)) {
    assert.equal(dot.opacity, 0.6);
    assert.equal(dot.transform[0].translateY, 0);
  }
  f.unmount(); assert.ok(f.calls.at(-1).cancelled);
});

test('typing footer is transient, disappears on failure/confirmation, and leaves the composer enabled', () => {
  const source = fs.readFileSync('app/(tabs)/chat.tsx', 'utf8');
  const ast = ts.createSourceFile('chat.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let footer, composer;
  function walk(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'ListFooterComponent') footer = node.initializer.expression;
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'MessageComposer') composer = node;
    ts.forEachChild(node, walk);
  }
  walk(ast); assert.ok(footer && composer);
  if (ts.isIdentifier(footer)) {
    const screen = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'ChatScreen');
    const declaration = screen.body.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === footer.text));
    footer = declaration.declarationList.declarations[0].initializer.arguments[0].body;
  }
  assert.ok(ts.isConditionalExpression(footer));
  const visible = vm.runInNewContext('(sendError, hasPendingReply) => ' + footer.condition.getText(ast));
  assert.equal(visible(false, true), true, 'immediate queued send');
  assert.equal(visible(false, true), true, 'local unresolved response');
  assert.equal(visible(false, false), false, 'confirmed and complete');
  assert.equal(visible(true, true), false, 'no endless typing on failed persistence');
  assert.ok(footer.whenTrue.getText(ast).includes('<TypingIndicator />'));
  assert.ok(!composer.attributes.properties.some(node => ['disabled', 'loading'].includes(node.name?.getText(ast))));
});
