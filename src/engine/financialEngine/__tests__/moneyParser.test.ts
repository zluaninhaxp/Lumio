/**
 * Testes do extrator de VALOR (moneyParser) — seções 7/8/9.
 * Fixa "hoje" = 2026-08-13 (quinta), igual aos demais suites.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanMoneyTokens, pickAmount, parseBRNumber } from '../moneyParser.ts';
import { normalizeMessage } from '../../taskEngine/normalize.ts';

function scan(text: string) {
  const tokens = normalizeMessage(text).tokens;
  return scanMoneyTokens(tokens);
}

// ─── parseBRNumber ─────────────────────────────────────────────────
test('parseBRNumber: formatos BR', () => {
  assert.equal(parseBRNumber('100'), 100);
  assert.equal(parseBRNumber('100,00'), 100);
  assert.equal(parseBRNumber('100.00'), 100);
  assert.equal(parseBRNumber('1.500'), 1500);
  assert.equal(parseBRNumber('1.500,00'), 1500);
  assert.equal(parseBRNumber('2.000.000'), 2000000);
});

// ─── formatos simples ──────────────────────────────────────────────
test('valor simples: "paguei 500"', () => {
  const s = scan('paguei 500');
  assert.equal(s.money.length, 1);
  assert.equal(s.money[0].amount, 500);
  assert.equal(s.money[0].strong, false);
});

test('"gastei 300 reais" -> forte', () => {
  const s = scan('gastei 300 reais');
  assert.equal(s.money[0].amount, 300);
  assert.equal(s.money[0].strong, true);
});

test('"R$ 100" e "R$100" -> forte', () => {
  assert.equal(scan('recebi R$ 100').money[0].amount, 100);
  assert.equal(scan('recebi R$100').money[0].amount, 100);
});

test('"100,00" e "100.00"', () => {
  assert.equal(scan('gastei 100,00').money[0].amount, 100);
  assert.equal(scan('gastei 100.00').money[0].amount, 100);
});

test('"1.500" e "1.500,00"', () => {
  assert.equal(scan('paguei 1.500').money[0].amount, 1500);
  assert.equal(scan('paguei 1.500,00').money[0].amount, 1500);
});

// ─── mil / k ───────────────────────────────────────────────────────
test('"mil reais" sozinho = 1000', () => {
  const s = scan('gastei mil reais');
  assert.equal(s.money.length, 1);
  assert.equal(s.money[0].amount, 1000);
});

test('"2 mil" = 2000', () => {
  assert.equal(scan('entrou 2 mil').money[0].amount, 2000);
});

test('"dois mil reais" = 2000', () => {
  assert.equal(scan('vendi por dois mil reais').money[0].amount, 2000);
});

test('"entrou 2k" = 2000', () => {
  assert.equal(scan('entrou 2k').money[0].amount, 2000);
});

test('"R$ 2 mil" = 2000', () => {
  assert.equal(scan('paguei R$ 2 mil').money[0].amount, 2000);
});

// ─── gírias ────────────────────────────────────────────────────────
test('"gastei 100 conto"', () => {
  assert.equal(scan('gastei 100 conto').money[0].amount, 100);
  assert.equal(scan('gastei uns 300 contos na farra').money[0].amount, 300);
});

// ─── números que NÃO são dinheiro (seção 3/7) ─────────────────────
test('"tenho reunião dia 20" -> sem valor', () => {
  const s = scan('tenho reunião dia 20');
  assert.equal(s.money.length, 0);
});

test('"20/08" não é dinheiro', () => {
  const s = scan('pago dia 20/08');
  assert.equal(s.money.length, 0);
});

test('"ligar para João às 15h" -> sem valor', () => {
  const s = scan('ligar para joão às 15h');
  assert.equal(s.money.length, 0);
});

test('"dia 20 às 15:30" -> sem valor', () => {
  const s = scan('dia 20 às 15:30');
  assert.equal(s.money.length, 0);
});

test('"comprar 10 sacos de cimento" -> quantidade, não valor forte', () => {
  const s = scan('comprar 10 sacos de cimento');
  assert.equal(s.money.length, 0);
  assert.equal(s.quantity.length, 1);
  assert.equal(s.quantity[0].value, 10);
});

// ─── quantidade vs valor (seção 8/9) ──────────────────────────────
test('"comprei 10 sacos por 500" -> valor 500 (após por), qtd 10', () => {
  const tokens = normalizeMessage('comprei 10 sacos por 500').tokens;
  const s = scanMoneyTokens(tokens);
  const picked = pickAmount(tokens, s);
  assert.equal(picked.amount, 500);
  assert.equal(picked.quantity, 10);
});

test('"vendi 5 peças por 100 cada" -> total 500 computado', () => {
  const tokens = normalizeMessage('vendi 5 peças por 100 cada').tokens;
  const s = scanMoneyTokens(tokens);
  const picked = pickAmount(tokens, s);
  assert.equal(picked.amount, 500);
  assert.equal(picked.computed, true);
  assert.equal(picked.quantity, 5);
});

// ─── parcelas (seção 36) ───────────────────────────────────────────
test('"comprei por 1.200 em 3x" -> valor 1200, parcelas 3', () => {
  const tokens = normalizeMessage('comprei por 1.200 em 3x').tokens;
  const s = scanMoneyTokens(tokens);
  assert.equal(s.installments, 3);
  const picked = pickAmount(tokens, s);
  assert.equal(picked.amount, 1200);
});

test('"em três vezes"', () => {
  const s = scan('comprei 900 em três vezes');
  assert.equal(s.installments, 3);
});
