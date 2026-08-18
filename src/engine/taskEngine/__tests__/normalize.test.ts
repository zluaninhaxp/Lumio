import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMessage, stripAccents } from '../normalize.ts';

test('normalize preserva original e lowercase com acentos mantidos', () => {
  const n = normalizeMessage('  Preciso comprar  cimento,  Amanhã.  ');
  assert.equal(n.original, '  Preciso comprar  cimento,  Amanhã.  ');
  assert.equal(n.text, 'preciso comprar cimento amanhã');
});

test('normaliza abreviações pra/pro/vc/q', () => {
  const n = normalizeMessage('tenho q comprar cimento pro João');
  assert.ok(n.text.includes('que comprar cimento para o'));
});

test('mantém ? para detectar pergunta', () => {
  const n = normalizeMessage('quanto custa comprar cimento?');
  assert.ok(n.text.includes('?'));
});

test('stripAccents remove acentos', () => {
  assert.equal(stripAccents('João orçamento amanhã'), 'Joao orcamento amanha');
});