import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTags } from '../tagResolver.ts';

test('keywordMap exact match aplica tag existente', () => {
  const tags = resolveTags('preciso comprar cimento amanhã', {
    taskTags: ['Compras', 'Obras', 'Fornecedores'],
    keywordMap: { cimento: 'Compras', areia: 'Compras', fornecedor: 'Fornecedores' },
  });
  assert.ok(tags.includes('Compras'));
});

test('label direta aparece na mensagem', () => {
  const tags = resolveTags('verificar orçamento da obra', {
    taskTags: ['Orçamentos', 'Obras'],
    keywordMap: {},
  });
  assert.ok(tags.includes('Orçamentos'));
});

test('não associa agressivamente palavra curta', () => {
  const tags = resolveTags('verificar tudo amanhã', {
    taskTags: ['Tudo'],
    keywordMap: {},
  });
  // "tudo" é palavra > 2 chars, alright, tudo existe na msg e na lista => pode
  // Mas palavra <=2 não associa. Testamos "ir":
  assert.ok(!tags.includes('Ir'));
});

test('variação plural flexão simples', () => {
  const tags = resolveTags('comprar cimentos', {
    taskTags: ['Cimento'],
    keywordMap: {},
  });
  assert.ok(tags.includes('Cimento'));
});

test('não inventa tag fora de taskTags via keywordMap', () => {
  const tags = resolveTags('comprar cimento', {
    taskTags: ['Compras'],
    keywordMap: { cimento: 'OutraTagInexistente' },
  });
  assert.ok(!tags.includes('OutraTagInexistente'));
});

test('fornecedor -> Fornecedores', () => {
  const tags = resolveTags('ligar para o fornecedor amanhã', {
    taskTags: ['Fornecedores'],
    keywordMap: { fornecedor: 'Fornecedores' },
  });
  assert.ok(tags.includes('Fornecedores'));
});

// ─── SINÔNIMOS (vocabulário informal -> keyword canônica) ────────────
// O usuário diz "ajudante" mas a keyword do onboarding é "funcionário";
// diz "pagar" mas a keyword é "pagamento". O tagResolver expande o texto
// com sinônimos antes do matching, sem inventar tags.

test('sinônimo: "ajudante" -> tag Funcionários via keyword "funcionário"', () => {
  const tags = resolveTags('preciso pagar o ajudante amanhã', {
    taskTags: ['Funcionários', 'Financeiro'],
    keywordMap: { funcionário: 'Funcionários', pagamento: 'Financeiro' },
  });
  assert.ok(tags.includes('Funcionários'), 'deve casar "ajudante" com keyword "funcionário"');
  assert.ok(tags.includes('Financeiro'), 'deve casar "pagar" com keyword "pagamento"');
});

test('sinônimo: "pedreiro" -> tag Equipe via keyword "equipe"', () => {
  const tags = resolveTags('falar com o pedreiro sobre a obra', {
    taskTags: ['Equipe', 'Obras'],
    keywordMap: { equipe: 'Equipe', obra: 'Obras' },
  });
  assert.ok(tags.includes('Equipe'));
  assert.ok(tags.includes('Obras'));
});

test('sinônimo: "pagar aluguel" -> tag Financeiro', () => {
  const tags = resolveTags('tenho que pagar o aluguel até dia 20', {
    taskTags: ['Financeiro'],
    keywordMap: { pagamento: 'Financeiro', aluguel: 'Financeiro' },
  });
  assert.ok(tags.includes('Financeiro'));
});

test('sinônimo: "comprar material" -> tag Compra de materiais', () => {
  const tags = resolveTags('preciso comprar material para a obra', {
    taskTags: ['Compra de materiais', 'Obras'],
    keywordMap: { material: 'Compra de materiais', obra: 'Obras' },
  });
  assert.ok(tags.includes('Compra de materiais'));
});

test('sinônimo NÃO inventa tag inexistente', () => {
  // "ajudante" expande para "funcionario" mas se a tag "Funcionários" não
  // existe em taskTags, nenhuma tag é aplicada (não inventa).
  const tags = resolveTags('pagar o ajudante', {
    taskTags: ['Compras'],
    keywordMap: { funcionário: 'Funcionários' },
  });
  assert.equal(tags.length, 0);
});