const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(props = {}) {
  const effects = [], cleanups = [], calls = [];
  let angle = 0;
  const rotation = { get: () => angle, set(value) { calls.push(value); if (typeof value === 'number') angle = value; } };
  const module = { exports: {} };
  const stubs = {
    react: { useEffect: effect => effects.push(effect) },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { View: 'View', StyleSheet: { create: value => value, absoluteFillObject: {} } },
    'react-native-reanimated': {
      __esModule: true, default: { View: 'AnimatedView' },
      useSharedValue: () => rotation, useAnimatedStyle: fn => ({ evaluate: fn }),
      cancelAnimation: value => calls.push({ cancelled: value }),
      Easing: { linear: 'linear' }, ReduceMotion: { Never: 'never' },
      withTiming: (to, config) => ({ to, config }),
      withRepeat: (animation, count, reverse, callback, reduceMotion) => ({ animation, count, reverse, reduceMotion }),
    },
    '../constants/theme': { Colors: { accentIcon: '#00A878' } },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/loading-spinner.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: name => { assert.ok(name in stubs, name); return stubs[name]; } });
  const tree = module.exports.LoadingSpinner(props);
  effects.forEach(effect => cleanups.push(effect()));
  return { tree, calls, frame(degrees) { angle = degrees; return tree.props.children.props.children[1].props.style.at(-1).evaluate(); }, unmount() { cleanups.forEach(fn => fn?.()); } };
}

test('spinner loops continuously on the UI thread and changes the visible rotation', () => {
  const f = fixture();
  const loop = f.calls.at(-1);
  assert.equal(loop.count, -1);
  assert.equal(loop.animation.to, 360);
  assert.equal(loop.animation.config.easing, 'linear');
  assert.equal(loop.reduceMotion, 'never', 'essential progress must not freeze into a static ring');
  assert.equal(loop.animation.config.reduceMotion, 'never');
  assert.equal(f.frame(0).transform[0].rotate, '0deg');
  assert.equal(f.frame(180).transform[0].rotate, '180deg');
  assert.equal(f.tree.props.accessibilityRole, 'progressbar');
  f.unmount();
  assert.ok(f.calls.at(-1).cancelled, 'unmount stops the animation');
});

test('stopped indicators hide and do not start a loop; numeric sizes and colors are preserved', () => {
  const stopped = fixture({ animating: false });
  assert.equal(stopped.tree, null);
  assert.equal(stopped.calls.length, 1);
  const large = fixture({ size: 44, color: '#ffffff', accessibilityLabel: 'Entrando' });
  assert.equal(large.tree.props.children.props.style.width, 44);
  assert.equal(large.tree.props.children.props.children[1].props.style[1].borderTopColor, '#ffffff');
  assert.equal(large.tree.props.accessibilityLabel, 'Entrando');
});

test('all app activity indicators use the shared animated spinner, including login', () => {
  const path = require('node:path');
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (file.endsWith('.tsx')) {
        const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        for (const statement of source.statements) if (ts.isImportDeclaration(statement) && statement.moduleSpecifier.text === 'react-native') {
          const bindings = statement.importClause?.namedBindings;
          if (bindings && ts.isNamedImports(bindings)) assert.ok(!bindings.elements.some(e => (e.propertyName ?? e.name).text === 'ActivityIndicator'), file);
        }
      }
    }
  }
  visit('app'); visit('src/components');
  const login = fs.readFileSync('src/components/auth-screen.tsx', 'utf8');
  assert.match(login, /busy \? <LoadingSpinner/);
  assert.match(login, /disabled=\{busy\}/);
  assert.match(login, /if \(pending.current\) return/);
});
