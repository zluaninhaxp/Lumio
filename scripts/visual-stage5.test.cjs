const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const { fixture } = require('./bottom-sheet-fixture.cjs');
const { evaluate, hash } = require('./visual-style-evaluator.cjs');
const baseline = require('./visual-stage5-style-baseline.json');
const gesture = nodes => nodes.find(node => node.props?.onPanResponderMove).props;

test('reduced sheets open and close immediately without automatic motion or duplicate dismissal', () => {
  const app = fixture({ reducedMotion: true }); app.render();
  assert.equal(app.values[0].value, 0); assert.equal(app.values[1].value, 1);
  assert.equal(app.animations.length, 0);
  app.ref.current.close(); app.ref.current.close();
  assert.equal(app.closed, 1); assert.equal(app.values[1].value, 0); assert.equal(app.animations.length, 0);
});
test('normal motion retains the existing spring curves and open/close durations', () => {
  const app = fixture(); const nodes = app.render();
  assert.equal(app.animations[0].config.tension, 65); assert.equal(app.animations[0].config.friction, 11);
  assert.equal(app.animations[1].config.duration, 250);
  gesture(nodes).onPanResponderRelease(null, { dy: 20, vy: 0 });
  assert.equal(app.animations.at(-1).config.tension, 70); assert.equal(app.animations.at(-1).config.friction, 10);
  app.ref.current.close(); assert.equal(app.closed, 1);
  assert.equal(app.animations.at(-1).config.duration, 220);
});
test('a reduced sheet can reopen after dismissal without invoking the previous close again', () => {
  const app = fixture({ reducedMotion: true }); app.render(); app.ref.current.close();
  app.render({ visible: false }); app.render({ visible: true });
  assert.equal(app.closed, 1); assert.equal(app.values[0].value, 0); assert.equal(app.values[1].value, 1);
  app.ref.current.close(); assert.equal(app.closed, 2); assert.equal(app.animations.length, 0);
});
test('reduced gestures still follow the finger and return directly on release or interruption', () => {
  const app = fixture({ reducedMotion: true }); const handlers = gesture(app.render());
  handlers.onPanResponderMove(null, { dy: 45 }); assert.equal(app.values[0].value, 45);
  handlers.onPanResponderRelease(null, { dy: 45, vy: 0 }); assert.equal(app.values[0].value, 0);
  handlers.onPanResponderMove(null, { dy: 30 }); handlers.onPanResponderTerminate(); assert.equal(app.values[0].value, 0);
  assert.equal(app.animations.length, 0); assert.equal(app.closed, 0);
  handlers.onPanResponderRelease(null, { dy: 100, vy: 0 }); assert.equal(app.closed, 1);
});
test('reduced dismissal keeps draft confirmation, keyboard Back and nondismissible forms', () => {
  const app = fixture({ reducedMotion: true }); app.render(); app.render({ draft: { name: 'Rascunho' } });
  app.openKeyboard(); app.modalRef.current.requestClose(); assert.equal(app.closed, 0); assert.equal(app.alerts.length, 0);
  const handlers = gesture(app.render()); handlers.onPanResponderMove(null, { dy: 120 });
  handlers.onPanResponderRelease(null, { dy: 120, vy: 0 });
  assert.equal(app.values[0].value, 0); assert.equal(app.alerts.length, 1); assert.equal(app.closed, 0);
  app.alerts[0][2][0].onPress(); app.render({ dismissible: false });
  app.ref.current.requestClose(); assert.equal(app.alerts.length, 1); assert.equal(app.closed, 0);
  app.ref.current.close(); assert.equal(app.closed, 1); assert.equal(app.animations.length, 0);
});
test('live preference changes update existing pan handlers and do not reopen or double-close a sheet', () => {
  const app = fixture({ deferClose: true, deferCancel: true }); const handlers = gesture(app.render());
  app.setReducedMotion(true); app.render(); const count = app.animations.length;
  handlers.onPanResponderRelease(null, { dy: 15, vy: 0 }); assert.equal(app.animations.length, count);
  app.setReducedMotion(false); app.render();
  handlers.onPanResponderRelease(null, { dy: 15, vy: 0 }); assert.equal(app.animations.at(-1).kind, 'spring');
  app.ref.current.close(); assert.equal(app.closed, 0);
  app.setReducedMotion(true); app.render(); assert.equal(app.closed, 1);
  app.finishCancelledAnimation(); app.finishAnimation(); app.ref.current.close(); assert.equal(app.closed, 1);
});
test('system preference hook ignores stale async reads, handles changes and unsubscribes', async () => {
  let value, listener, resolve, cleanup, subscribed = false, removed = false;
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/hooks/use-system-reduced-motion.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module, exports: module.exports, require(name) {
    if (name === 'react') return { useState: initial => { if (value === undefined) value = initial; return [value, v => { value = v; }]; },
      useEffect: callback => { if (!subscribed) { subscribed = true; cleanup = callback(); } } };
    if (name === 'react-native-reanimated') return { useReducedMotion: () => false };
    return { AccessibilityInfo: { addEventListener(event, callback) { assert.equal(event, 'reduceMotionChanged'); listener = callback; return { remove() { removed = true; } }; },
      isReduceMotionEnabled: () => new Promise(r => { resolve = r; }) } };
  } });
  const hook = module.exports.useSystemReducedMotion;
  assert.equal(hook(), false); listener(true); resolve(false); await Promise.resolve();
  assert.equal(hook(), true); listener(false); assert.equal(hook(), false);
  cleanup(); assert.equal(removed, true); listener(true); assert.equal(hook(), false);
});
test('semantic text roles include approved family, size, line-height and color; native migration preserves metrics', () => {
  const { TextStyles, Typography, nativeTextStyle } = evaluate('src/constants/theme.ts').exports;
  for (const style of Object.values(TextStyles)) {
    assert.ok(Object.values(Typography).includes(style.fontFamily)); assert.ok(style.fontSize > 0);
    assert.ok(style.lineHeight >= style.fontSize); assert.ok(style.color);
    const native = nativeTextStyle(style); assert.equal(native.lineHeight, undefined);
    assert.equal(native.fontSize, style.fontSize); assert.equal(native.fontFamily, style.fontFamily); assert.equal(native.color, style.color);
  }
});
test('baseline preserves layouts with approved empty/header and shared surface changes', () => {
  const replacements = require('./visual-stage6-replaced-styles.json');
  let checked = 0;
  for (const [file, expected] of Object.entries(baseline)) {
    const current = evaluate(file).styles;
    for (const [key, digest] of Object.entries(expected)) {
      // Low stock now uses the existing icon/badge, without outlining its card.
      if (file === 'app/plugins/estoque.tsx' && key === 'cardLow') {
        assert.equal(current[key], undefined); checked++; continue;
      }
      if (replacements[file]?.includes(key)) {
        assert.equal(current[key], undefined, `${file}: replaced local style ${key} returned`);
        checked++; continue;
      }
      assert.ok(current[key], `${file}: missing ${key}`);
      assert.equal(hash(current[key]), digest, `${file}: effective properties changed for ${key}`); checked++;
    }
  }
  assert.equal(checked, 817);
});
test('local form styles no longer declare keys overridden by a later shared spread', () => {
  const shared = evaluate('src/components/Forms/pluginFormStyles.ts').exports.pluginFormStyles;
  for (const file of Object.keys(baseline).filter(file => file.startsWith('app/plugins/'))) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isObjectLiteralExpression(node)) node.properties.forEach((property, index) => {
        if (!ts.isPropertyAssignment(property)) return;
        const shadowed = node.properties.slice(index + 1).some(p => ts.isSpreadAssignment(p) && p.expression.getText(source) === 'pluginFormStyles');
        if (shadowed) assert.equal(Object.hasOwn(shared, property.name.getText(source)), false, `${file}: redundant ${property.name.getText(source)}`);
      });
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.equal(shared.selectChip, shared.chip); assert.equal(shared.selectChipActive, shared.chipActive);
  assert.equal(shared.selectChipText, shared.chipText); assert.equal(shared.selectChipTextActive, shared.chipTextActive);
});
