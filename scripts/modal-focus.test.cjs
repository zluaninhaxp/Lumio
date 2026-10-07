const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const compiled = new Module('modal-focus');
compiled._compile(ts.transpileModule(fs.readFileSync('src/utils/modalFocus.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, 'modal-focus.cjs');
const { getModalFocusScrollOffset: reveal } = compiled.exports;
const base = { offset: 100, viewportTop: 120, viewportHeight: 400, keyboardTop: 560, inputTop: 300, inputHeight: 48 };

test('switching to an already visible field preserves the current scroll position', () => {
  assert.equal(reveal(base), 100);
});
test('a last field reveals above the fixed footer even when the keyboard is lower', () => {
  const next = reveal({ ...base, inputTop: 490 });
  assert.equal(490 + 48 - (next - base.offset), 504);
});
test('keyboard changing height reveals a field that previously fit', () => {
  const next = reveal({ ...base, keyboardTop: 330 });
  assert.equal(300 + 48 - (next - base.offset), 314);
});
test('switching back to a field above the viewport scrolls upwards and clamps at zero', () => {
  assert.equal(reveal({ ...base, inputTop: 90 }), 54);
  assert.equal(reveal({ ...base, offset: 10, inputTop: 90 }), 0);
});
test('a tall multiline field keeps its start reachable in a small viewport', () => {
  assert.equal(reveal({ ...base, inputTop: 136, inputHeight: 900 }), 100);
});
test('focus still respects the form viewport when keyboard metrics are unavailable', () => {
  assert.equal(reveal({ ...base, keyboardTop: Infinity, inputTop: 490 }), 134);
});

test('every native modal with a text field uses a keyboard viewport', () => {
  const path = require('node:path');
  let audited = 0;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!file.endsWith('.tsx')) continue;
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const tag = node => ts.isJsxElement(node) ? node.openingElement.tagName.getText(source) : ts.isJsxSelfClosingElement(node) ? node.tagName.getText(source) : '';
      const contains = (node, name) => tag(node) === name || !!ts.forEachChild(node, child => contains(child, name) || undefined);
      function visit(node) {
        if (tag(node) === 'Modal' && contains(node, 'TextInput')) {
          audited++;
          assert.ok(contains(node, 'ModalKeyboardViewport'), `${file}: text fields must remain reachable with the keyboard open`);
        }
        if (tag(node) === 'BottomSheet') {
          function auditScroll(child) {
            if (tag(child) === 'ScrollView') {
              const attributes = ts.isJsxElement(child) ? child.openingElement.attributes : child.attributes;
              assert.ok(attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'horizontal'),
                `${file}: modal forms must use the shared focus-aware vertical scroll view`);
            }
            ts.forEachChild(child, auditScroll);
          }
          auditScroll(node);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  walk('app'); walk('src');
  assert.ok(audited >= 3, 'audit must cover search pickers and the tag editor');
});
