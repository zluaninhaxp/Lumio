const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const compiled = new Module('bottom-sheet-layout');
compiled._compile(ts.transpileModule(fs.readFileSync('src/utils/bottomSheetLayout.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, 'bottom-sheet-layout.cjs');
const { getBottomSheetLayout, isBottomKeyboard } = compiled.exports;
const base = { viewportHeight: 800, topInset: 24, bottomInset: 0, keyboardVisible: false, paddingBottom: 32, minHeight: 0 };

test('three-button, gesture, iOS and zero insets add only the actual system inset', () => {
  for (const bottomInset of [0, 16, 24, 34, 48]) {
    const layout = getBottomSheetLayout({ ...base, bottomInset });
    assert.equal(layout.paddingBottom, 32 + bottomInset);
    assert.equal(layout.height, undefined, 'natural sheets must never receive a fixed height');
    assert.equal(layout.maxHeight, 776);
  }
});
test('content remains intrinsic at every viewport size; long sheets are capped below the status bar', () => {
  for (const viewportHeight of [240, 480, 800, 1200]) {
    const layout = getBottomSheetLayout({ ...base, viewportHeight, bottomInset: 34 });
    assert.equal(layout.height, undefined);
    assert.equal(layout.maxHeight, viewportHeight - 24);
  }
});
test('keyboard viewport is already reduced: do not subtract keyboard height or add bottom inset again', () => {
  const layout = getBottomSheetLayout({ ...base, viewportHeight: 440, bottomInset: 34, keyboardVisible: true });
  assert.equal(layout.paddingBottom, 32);
  assert.equal(layout.maxHeight, 416);
  assert.equal(layout.height, undefined);
  assert.equal(getBottomSheetLayout({ ...base, bottomInset: 34 }).paddingBottom, 66);
});
test('sales and quotes measured heights grow by inset without exceeding either cap', () => {
  assert.equal(getBottomSheetLayout({ ...base, bottomInset: 48, sheetHeight: 360, maxHeight: 640 }).height, 408);
  assert.equal(getBottomSheetLayout({ ...base, bottomInset: 48, sheetHeight: 620, maxHeight: 640 }).height, 640);
  const keyboard = getBottomSheetLayout({ ...base, viewportHeight: 400, keyboardVisible: true, bottomInset: 48, sheetHeight: 620, maxHeight: 640, minHeight: 600 });
  assert.equal(keyboard.height, 376);
  assert.equal(keyboard.minHeight, 376);
});
test('percent heights follow current modal viewport, including rotation; minima cannot overflow', () => {
  const portrait = getBottomSheetLayout({ ...base, sheetHeight: '80%' });
  const landscape = getBottomSheetLayout({ ...base, viewportHeight: 400, sheetHeight: '80%' });
  assert.ok(Math.abs(portrait.height - 776 * 0.8) < 1e-9);
  assert.ok(Math.abs(landscape.height - 376 * 0.8) < 1e-9);
  assert.deepEqual(getBottomSheetLayout({ ...base, viewportHeight: 0, minHeight: 100 }), { paddingBottom: 32, minHeight: 0, maxHeight: 0, height: undefined });
});
test('docked keyboards replace bottom safe area; floating and hidden keyboards preserve it', () => {
  assert.equal(isBottomKeyboard({ width: 390, screenY: 500, height: 300 }, 390, 800, 34), true);
  assert.equal(isBottomKeyboard({ width: 390, screenY: 500, height: 276 }, 390, 800, 24), true);
  assert.equal(isBottomKeyboard({ width: 280, screenY: 400, height: 240 }, 768, 1024, 20), false);
  assert.equal(isBottomKeyboard({ width: 768, screenY: 400, height: 240 }, 768, 1024, 20), false);
  assert.equal(isBottomKeyboard({ width: 390, screenY: 800, height: 300 }, 390, 800, 34), false);
  assert.equal(isBottomKeyboard(undefined, 390, 800, 34), false);
});
