import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTemporal, humanizeDueDate } from '../temporal.ts';

// Fixa "hoje" para tornar os testes determinísticos: 2026-08-13 (quinta-feira).
const NOW = new Date(2026, 7, 13, 10, 0, 0, 0); // mês 7 = agosto (0-indexed)

function due(text: string): { dueDate: string | null; dueTime: string | null; isDeadline: boolean } {
  const { resolution } = resolveTemporal(text.toLowerCase().split(' '), NOW);
  return { dueDate: resolution.dueDate, dueTime: resolution.dueTime, isDeadline: resolution.isDeadline };
}

test('hoje', () => {
  assert.equal(due('hoje').dueDate, '2026-08-13');
});

test('amanhã', () => {
  assert.equal(due('amanhã').dueDate, '2026-08-14');
});

test('depois de amanhã', () => {
  assert.equal(due('depois de amanhã').dueDate, '2026-08-15');
});

test('sexta (a partir de quinta => próxima sexta = amanhã, 14)', () => {
  // hoje é quinta 13; "sexta" deve resolver para 14 (amanhã)
  assert.equal(due('sexta').dueDate, '2026-08-14');
});

test('segunda (vira a próxima segunda, dia 17)', () => {
  assert.equal(due('segunda').dueDate, '2026-08-17');
});

test('próxima sexta (força próxima semana, 21)', () => {
  assert.equal(due('próxima sexta').dueDate, '2026-08-21');
});

test('amanhã às 10', () => {
  const r = due('amanhã às 10');
  assert.equal(r.dueDate, '2026-08-14');
  assert.equal(r.dueTime, '10:00');
});

test('amanhã às 15h30', () => {
  const r = due('amanhã às 15h30');
  assert.equal(r.dueTime, '15:30');
});

test('sexta às 10', () => {
  const r = due('sexta às 10');
  assert.equal(r.dueDate, '2026-08-14');
  assert.equal(r.dueTime, '10:00');
});

test('daqui a 3 dias', () => {
  assert.equal(due('daqui a 3 dias').dueDate, '2026-08-16');
});

test('em 2 dias', () => {
  assert.equal(due('em 2 dias').dueDate, '2026-08-15');
});

test('daqui a uma semana', () => {
  assert.equal(due('daqui a uma semana').dueDate, '2026-08-20');
});

test('dia 20', () => {
  assert.equal(due('dia 20').dueDate, '2026-08-20');
});

test('dia 20 de agosto', () => {
  assert.equal(due('dia 20 de agosto').dueDate, '2026-08-20');
});

test('20/08', () => {
  assert.equal(due('20/08').dueDate, '2026-08-20');
});

test('20/08/2026', () => {
  assert.equal(due('20/08/2026').dueDate, '2026-08-20');
});

test('semana que vem (próxima segunda, 17)', () => {
  // hoje é quinta 13; "semana que vem" => próxima segunda 17
  assert.equal(due('semana que vem').dueDate, '2026-08-17');
});

test('horário isolado às 15h', () => {
  const r = due('às 15h');
  assert.equal(r.dueTime, '15:00');
  assert.equal(r.dueDate, '2026-08-13'); // hoje
});

test('humanizeDueDate Hoje/Amanhã/Atrasada', () => {
  assert.equal(humanizeDueDate('2026-08-13', NOW), 'Hoje');
  assert.equal(humanizeDueDate('2026-08-14', NOW), 'Amanhã');
  assert.equal(humanizeDueDate('2026-08-10', NOW), 'Atrasada');
  assert.equal(humanizeDueDate(null, NOW), null);
});