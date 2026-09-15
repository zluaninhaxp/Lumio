import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTaskMessage } from '../taskParser.ts';
import type { TaskParserContext } from '../types.ts';

const NOW = new Date(2026, 7, 13, 10, 0, 0, 0);

function context(people: TaskParserContext['people'] = [{ id: 'joao', name: 'João' }]): TaskParserContext {
  return { now: NOW, people, taskTags: [], keywordMap: {} };
}

function task(message: string, people = context().people) {
  const result = parseTaskMessage(message, context(people));
  assert.equal(result.intent, 'create_task', message);
  assert.equal(result.tasks.length, 1, message);
  return result.tasks[0];
}

test('regressão: pessoa não cadastrada mantém case e não deixa "com" solto', () => {
  const t = task('Preciso falar com o Carlos sobre o orçamento');
  assert.equal(t.assigneeId, null);
  assert.equal(t.assigneeName, 'Carlos');
  assert.match(t.title, /^Falar com Carlos sobre o orçamento$/);
  assert.doesNotMatch(`${t.title} ${t.description ?? ''}`, /preciso|precisa|duplicad|\bcom\s*$/i);
});

test('regressão: pessoa cadastrada é responsável, sem repetir o nome no título', () => {
  const t = task('Preciso falar com o Carlos sobre o orçamento', [{ id: 'carlos', name: 'Carlos' }]);
  assert.equal(t.assigneeId, 'carlos');
  assert.equal(t.assigneeName, 'Carlos');
  assert.doesNotMatch(t.title, /Carlos/i);
  assert.match(t.title, /^Falar sobre o orçamento$/);
});

test('regressão: pessoa cadastrada e não cadastrada após "pro"', () => {
  const registered = task('Lembra de ligar pro João amanhã');
  const unknown = task('Lembra de ligar pro João amanhã', []);
  assert.equal(registered.assigneeId, 'joao');
  assert.equal(unknown.assigneeId, null);
  assert.equal(unknown.assigneeName, 'João');
  assert.match(unknown.title, /^Ligar com João$/);
});

test('regressão: frases de compras e lembrete não repetem verbo nem wrapper', () => {
  const buying = task('Preciso comprar cimento e areia pra obra');
  const bill = task('Não posso esquecer de pagar o boleto da luz');
  assert.match(buying.title, /^Comprar /);
  assert.doesNotMatch(`${buying.title} ${buying.description ?? ''}`, /preciso|comprar.*comprar/i);
  assert.match(bill.title, /^Pagar /);
  assert.doesNotMatch(`${bill.title} ${bill.description ?? ''}`, /posso|esquecer|pagar.*pagar/i);
});

test('regressão: dia da semana com espaço não deixa "feira" no título', () => {
  const t = task('fazer orçamento quinta feira', []);
  assert.equal(t.title, 'Fazer orçamento');
  assert.equal(t.dueDate, '2026-08-13');
  assert.doesNotMatch(t.title, /feira/i);
});

test('regressão: cinco frases informais permanecem gramaticais', () => {
  const cases = [
    'Preciso enviar o relatório para a equipe',
    'Tenho que revisar o contrato com a Ana',
    'Anota comprar tinta para a sala',
    'Preciso marcar reunião com Pedro sobre orçamento',
    'Quero lembrar de renovar o seguro do carro',
  ];

  for (const message of cases) {
    const t = task(message, [{ id: 'ana', name: 'Ana' }]);
    const output = `${t.title} ${t.description ?? ''}`;
    assert.doesNotMatch(output, /preciso|precisa|tenho que|anota|quero lembrar|esquecer/i, message);
    assert.doesNotMatch(output, /\b(com|para|pra|pro)\s*$/i, message);
    console.log(`[task-regression] ${message} -> título: ${t.title}; descrição: ${t.description ?? '(null)'}`);
  }
});
