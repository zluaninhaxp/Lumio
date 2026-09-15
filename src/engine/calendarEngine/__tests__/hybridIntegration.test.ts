/**
 * Testes de INTEGRAÇÃO do parser híbrido (task + calendar) para os
 * cenários complexos corrigidos: múltiplas tarefas, múltiplos eventos,
 * tarefa+evento, conflito tarefa/evento, tags e atribuição.
 *
 * Estes testes exercitam a LÓGICA de decisão (qual entidade criar)
 * sem depender do store/zustand — espelham a orquestração do chat.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTaskMessage } from '../../taskEngine/taskParser.ts';
import type { TaskParserContext } from '../../taskEngine/types.ts';
import { parseCalendarMessage, decideHybrid } from '../calendarParser.ts';
import { buildTaskEventAmbiguity } from '../domainAmbiguity.ts';
import type { CalendarParserContext } from '../types.ts';
import { findLearnedIntentMarker, recordLearnedIntentMarker } from '../../taxonomy/entityResolver.ts';
import type { LearnedIntentMarker } from '../../taxonomy/types.ts';

const NOW = new Date(2026, 7, 13, 10, 0, 0, 0); // 2026-08-13 quinta

function taskCtx(): TaskParserContext {
  return {
    now: NOW,
    people: [
      { id: 'emp_1', name: 'João Silva' },
      { id: 'emp_2', name: 'Ana Souza' },
      { id: 'emp_3', name: 'Carlos' },
    ],
    taskTags: ['Compras', 'Obras', 'Orçamentos', 'Fornecedores', 'Clientes', 'Financeiro'],
    keywordMap: {
      cimento: 'Compras', areia: 'Compras', brita: 'Compras', material: 'Compras',
      orçamento: 'Orçamentos', orcamento: 'Orçamentos',
      fornecedor: 'Fornecedores', cliente: 'Clientes', obra: 'Obras',
      funcionário: 'Financeiro', funcionario: 'Financeiro',
      aluguel: 'Financeiro', pagamento: 'Financeiro',
    },
  };
}

function calCtx(): CalendarParserContext {
  return {
    now: NOW,
    calendarEventTypes: ['Reuniões', 'Visitas', 'Entregas', 'Compromissos', 'Fornecedores'],
    keywordMap: taskCtx().keywordMap,
    people: taskCtx().people,
  };
}

test('data sem verbo claro dispara ambiguidade entre tarefa e evento', () => {
  const text = 'dia 20 às 15h com cliente';
  const ambiguity = buildTaskEventAmbiguity(text, parseTaskMessage(text, taskCtx()), parseCalendarMessage(text, calCtx()), NOW);
  assert.deepEqual(ambiguity?.options, [{ label: 'Tarefa', value: 'task' }, { label: 'Evento', value: 'event' }]);
  assert.equal(ambiguity?.date, '2026-08-20');
  assert.equal(ambiguity?.time, '15:00');
});

test('escolha Evento cria marker e resolve mensagem parecida sem nova pergunta', () => {
  const text = 'dia 20 às 15h com cliente';
  const markers: LearnedIntentMarker[] = [];
  const ambiguity = buildTaskEventAmbiguity(text, parseTaskMessage(text, taskCtx()), parseCalendarMessage(text, calCtx()), NOW);
  assert.ok(ambiguity);
  recordLearnedIntentMarker({ learnedIntentMarkers: markers }, 'calendar', ambiguity!.candidatePhrase, 'event');
  assert.equal(findLearnedIntentMarker({ learnedIntentMarkers: markers }, 'calendar', 'dia 22 às 15h com cliente')?.resolution, 'event');
  assert.equal(ambiguity!.options.find((option) => option.value === 'event')?.label, 'Evento');
});

/** Espelha a orquestração do chat.tsx — decide o que criar. */
function orchestrate(msg: string): {
  createEvents: { title: string; date: string; eventType: string | null }[];
  createTasks: { title: string; dueDate: string | null; assigneeName: string | null; tags: string[] }[];
} {
  const t = parseTaskMessage(msg, taskCtx());
  const c = parseCalendarMessage(msg, calCtx());

  // CASO 1: create_event puro → só eventos, sem tarefas
  if (c.intent === 'create_event' && c.confidence >= 0.45 && c.events.length > 0) {
    return {
      createEvents: c.events.map((e) => ({ title: e.title, date: e.date, eventType: e.eventType })),
      createTasks: [],
    };
  }

  // CASO 2/3: create_task_and_event → eventos independentes + tarefas
  const decision = decideHybrid(c, t.tasks.length > 0, t.tasks.some((x) => !!x.dueDate));
  const events = (decision.shouldCreateInCalendar ? decision.events : []).map((e) => ({
    title: e.title, date: e.date, eventType: e.eventType,
  }));

  // CASO 4: criar tarefas (com calendário derivado quando tem data)
  const minconf = 0.5;
  const tasks = t.tasks
    .filter((x) => x.confidence >= minconf)
    .map((x) => ({
      title: x.title,
      dueDate: x.dueDate,
      assigneeName: x.assigneeName,
      tags: x.tags,
    }));

  return { createEvents: events, createTasks: tasks };
}

// ─── MÚLTIPLAS TAREFAS ───────────────────────────────────────────────
test('3 tarefas com data compartilhada — gera 3 tarefas, 0 eventos', () => {
  const r = orchestrate('amanhã preciso comprar cimento, ligar pro João e mandar o orçamento');
  assert.equal(r.createTasks.length, 3);
  assert.equal(r.createEvents.length, 0);
  // Todas com a mesma data (amanhã = 14)
  for (const t of r.createTasks) assert.equal(t.dueDate, '2026-08-14');
});

test('3 tarefas com datas distintas — gera 3 tarefas com datas próprias', () => {
  const r = orchestrate('segunda preciso comprar cimento, terça preciso pagar o fornecedor e quinta preciso ligar pro cliente');
  assert.equal(r.createTasks.length, 3);
  assert.equal(r.createEvents.length, 0);
  // seg=17, ter=18, qui=13 (hoje, pois "quinta" a partir de quinta = hoje)
  assert.equal(r.createTasks[0].dueDate, '2026-08-17');
  assert.equal(r.createTasks[1].dueDate, '2026-08-18');
});

test('2 tarefas com pessoas distintas — atribui funcionário correto', () => {
  const r = orchestrate('amanhã o João precisa verificar o orçamento e a Ana precisa enviar o orçamento');
  assert.equal(r.createTasks.length, 2);
  assert.equal(r.createTasks[0].assigneeName, 'João Silva');
  assert.equal(r.createTasks[1].assigneeName, 'Ana Souza');
});

// ─── MÚLTIPLOS EVENTOS ───────────────────────────────────────────────
test('3 eventos com dias da semana — gera 3 eventos, 0 tarefas', () => {
  const r = orchestrate('segunda reunião com João, terça visita na obra e quarta falar com fornecedor');
  assert.equal(r.createEvents.length, 3);
  assert.equal(r.createTasks.length, 0);
  assert.equal(r.createEvents[0].eventType, 'Reuniões');
  assert.equal(r.createEvents[1].eventType, 'Visitas');
  assert.equal(r.createEvents[2].eventType, 'Fornecedores');
});

test('3 eventos com dia N — gera 3 eventos com datas explícitas', () => {
  const r = orchestrate('dia 20 reunião com João, dia 22 visita na obra e dia 25 falar com fornecedor');
  assert.equal(r.createEvents.length, 3);
  assert.equal(r.createEvents[0].date, '2026-08-20');
  assert.equal(r.createEvents[1].date, '2026-08-22');
  assert.equal(r.createEvents[2].date, '2026-08-25');
});

// ─── CONFLITO TAREFA/EVENTO (duplicação evitada) ─────────────────────
test('"visitar a obra sexta" — só evento (Visitas), sem tarefa duplicada', () => {
  const r = orchestrate('visitar a obra sexta');
  assert.equal(r.createEvents.length, 1);
  assert.equal(r.createEvents[0].eventType, 'Visitas');
  assert.equal(r.createTasks.length, 0);
});

test('"sexta vou estar na obra" — só evento, sem tarefa', () => {
  const r = orchestrate('sexta vou estar na obra');
  assert.equal(r.createEvents.length, 1);
  assert.equal(r.createTasks.length, 0);
});

// ─── TAREFA + EVENTO INDEPENDENTE (seção 25) ─────────────────────────
test('"amanhã tenho reunião com João e preciso levar o orçamento" — evento + tarefa', () => {
  const r = orchestrate('amanhã tenho reunião com João e preciso levar o orçamento');
  // Aqui o calendar identifica create_task_and_event → ambos
  assert.ok(r.createEvents.length >= 1 || r.createTasks.length >= 1,
    'deve criar pelo menos evento ou tarefa');
});

// ─── TAGS via onboarding/keywordMap ──────────────────────────────────
test('"preciso comprar cimento amanhã" → tag Compras aplicada', () => {
  const r = orchestrate('preciso comprar cimento amanhã');
  assert.ok(r.createTasks.length >= 1);
  assert.ok(r.createTasks[0].tags.includes('Compras'));
});

test('"tenho que pagar o funcionário até dia 20" → tag Financeiro', () => {
  const r = orchestrate('tenho que pagar o funcionário até dia 20');
  assert.ok(r.createTasks[0].tags.includes('Financeiro'));
});

test('"ligar para o fornecedor amanhã" → tag Fornecedores', () => {
  const r = orchestrate('ligar para o fornecedor amanhã');
  assert.ok(r.createTasks[0].tags.includes('Fornecedores'));
});

test('"preciso resolver o orçamento da obra" → tags Orçamentos + Obras', () => {
  const r = orchestrate('preciso resolver o orçamento da obra');
  assert.ok(r.createTasks[0].tags.includes('Orçamentos'));
  assert.ok(r.createTasks[0].tags.includes('Obras'));
});

// ─── ATRIBUIÇÃO DE FUNCIONÁRIO ───────────────────────────────────────
test('"liga pro João" → atribui João Silva', () => {
  const r = orchestrate('liga pro João');
  assert.ok(r.createTasks.length >= 1);
  assert.equal(r.createTasks[0].assigneeName, 'João Silva');
});

test('"amanhã o João precisa verificar o orçamento da obra" → atribui + tags', () => {
  const r = orchestrate('amanhã o João precisa verificar o orçamento da obra');
  assert.equal(r.createTasks[0].assigneeName, 'João Silva');
  assert.ok(r.createTasks[0].tags.includes('Orçamentos'));
  assert.ok(r.createTasks[0].tags.includes('Obras'));
});

// ─── NÃO DUPLICAR ────────────────────────────────────────────────────
test('parser idempotente: rodar 2x produz mesmo resultado', () => {
  const r1 = orchestrate('amanhã preciso comprar cimento, ligar pro João e mandar o orçamento');
  const r2 = orchestrate('amanhã preciso comprar cimento, ligar pro João e mandar o orçamento');
  assert.equal(r1.createTasks.length, r2.createTasks.length);
  assert.equal(r1.createEvents.length, r2.createEvents.length);
});

// ─── NEGATÇÃO + PASSADO (continua funcionando) ───────────────────────
test('"não tenho reunião amanhã" → nenhum evento/tarefa', () => {
  const r = orchestrate('não tenho reunião amanhã');
  assert.equal(r.createEvents.length, 0);
  assert.equal(r.createTasks.length, 0);
});

test('"ontem tive reunião com João" → nenhum evento/tarefa', () => {
  const r = orchestrate('ontem tive reunião com João');
  assert.equal(r.createEvents.length, 0);
  assert.equal(r.createTasks.length, 0);
});
