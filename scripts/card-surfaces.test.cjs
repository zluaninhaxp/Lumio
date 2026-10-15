const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { evaluate } = require('./visual-style-evaluator.cjs');

function themeFor(OS, Version) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/constants/theme.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: () => ({ Platform: { OS, Version } }) });
  return module.exports;
}

for (const [os, version] of [['android', 24], ['android', 27], ['android', 28], ['android', 31], ['android', 36], ['ios', 15], ['web', undefined]]) {
  test(`content surfaces match Chat without stacking shadows: ${os} ${version}`, () => {
    const { SurfaceStyles: surfaces } = themeFor(os, version);
    for (const role of ['card', 'list']) {
      assert.equal(surfaces[role].backgroundColor, '#FFFFFF');
      assert.equal(surfaces[role].borderWidth ?? 0, 0);
      assert.equal(surfaces[role].boxShadow, surfaces.message.boxShadow);
      assert.equal(surfaces[role].elevation, surfaces.message.elevation);
      assert.ok(!(surfaces[role].boxShadow && surfaces[role].elevation));
    }
    for (const role of ['control', 'filter']) {
      assert.equal(surfaces[role].borderWidth, 1);
      assert.equal(surfaces[role].borderColor, '#C9D0D4');
    }
    assert.ok(surfaces.overlay.borderWidth > 0);
  });
}

test('module content cards inherit the shared surface without local outlines', () => {
  for (const module of ['catalogo', 'estoque', 'clientes', 'fornecedores', 'equipe', 'vendas', 'orcamentos', 'contratos', 'entregas', 'comissoes', '[id]']) {
    const { card } = evaluate(`app/plugins/${module}.tsx`).styles;
    assert.equal(card.backgroundColor, '#FFFFFF', module);
    assert.equal(card.borderWidth ?? 0, 0, module);
    assert.equal(card.boxShadow, themeFor('android', 35).SurfaceStyles.message.boxShadow, module);
    assert.ok(card.borderRadius > 0, module);
  }
});

test('stock warnings and financial selection preserve non-border status cues', () => {
  const stock = evaluate('app/plugins/estoque.tsx').styles;
  assert.equal(stock.cardLow, undefined);
  assert.ok(stock.iconCircleLow.backgroundColor);
  assert.ok(stock.alertText.color);
  const finance = evaluate('src/components/Finance/TransactionItem.tsx').styles;
  assert.equal(finance.card.borderWidth, 0);
  assert.equal(finance.cardSelected.borderWidth, undefined);
  assert.ok(finance.cardSelected.backgroundColor);
  assert.ok(finance.selectCircleActive.backgroundColor);
  assert.equal(finance.selectCircle.borderWidth, 2);
  const commissions = evaluate('app/plugins/comissoes.tsx').styles;
  assert.equal(commissions.summaryCard.backgroundColor, '#FFFFFF');
  assert.equal(commissions.summaryCard.borderWidth, 0);
  const store = evaluate('app/plugins/store.tsx').styles;
  assert.equal(store.cardHighlighted.borderWidth, undefined);
  assert.ok(store.cardHighlighted.backgroundColor);
});
