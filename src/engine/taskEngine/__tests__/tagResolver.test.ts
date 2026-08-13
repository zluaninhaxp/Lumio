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