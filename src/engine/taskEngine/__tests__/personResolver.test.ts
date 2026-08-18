import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePerson } from '../personResolver.ts';
import type { PersonRef } from '../types.ts';

const people: PersonRef[] = [
  { id: 'emp_1', name: 'João Silva' },
  { id: 'emp_2', name: 'Ana Souza' },
  { id: 'emp_3', name: 'Carlos' },
  { id: 'emp_4', name: 'Maria Oliveira' },
];

test('resolve pessoa antes da ação (o João precisa verificar)', () => {
  const r = resolvePerson('o João precisa verificar o orçamento amanhã', people);
  // "o João" — personResolver procura por nome real; "joão" parcial casa João Silva
  assert.equal(r.id, 'emp_1');
});

test('resolve pessoa depois da ação (ligar pro João)', () => {
  const r = resolvePerson('ligar pro João', people);
  assert.equal(r.id, 'emp_1');
});

test('com Ana', () => {
  const r = resolvePerson('fala com a Ana amanhã', people);
  assert.equal(r.id, 'emp_2');
});

test('atribui para Maria', () => {
  const r = resolvePerson('atribui essa tarefa pra Maria', people);
  assert.equal(r.id, 'emp_4');
});

test('não inventa pessoa fora do contexto', () => {
  const r = resolvePerson('falar com o Pedro amanhã', people);
  // Pedro não existe — não devolve id
  assert.equal(r.id, null);
  assert.equal(r.name, 'Pedro');
});

test('ambiguidade: Carlos único, mas "João" case parcial casa um', () => {
  const r = resolvePerson('verificar com Carlos amanhã', people);
  assert.equal(r.id, 'emp_3');
});

test('sem pessoas no contexto — devolve null', () => {
  const r = resolvePerson('ligar pro João', []);
  assert.equal(r.id, null);
  assert.equal(r.name, null);
});