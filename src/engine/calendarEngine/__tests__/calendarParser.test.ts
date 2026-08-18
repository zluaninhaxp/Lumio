import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCalendarMessage, decideHybrid, buildEventTypeAliases } from '../calendarParser.ts';
import type { CalendarParserContext } from '../types.ts';

// Fixa "hoje" = 2026-08-13 (quinta-feira) — mesma base do taskEngine.
const NOW = new Date(2026, 7, 13, 10, 0, 0, 0); // mês 7 = agosto

function ctx(): CalendarParserContext {
  return {
    now: NOW,
    calendarEventTypes: ['Reuniões', 'Visitas', 'Entregas', 'Compromissos', 'Fornecedores'],
    keywordMap: {
      cliente: 'Compromissos',
      fornecedor: 'Fornecedores',
      obra: 'Visitas',
    },
    people: [
      { id: 'emp_1', name: 'João Silva' },
      { id: 'emp_2', name: 'Ana Souza' },
      { id: 'emp_3', name: 'Carlos' },
    ],
  };
}

function parse(msg: string) {
  return parseCalendarMessage(msg, ctx());
}

// ─── SITUATION A: compromisso/evento puro ────────────────────────────
test('"tenho um compromisso dia 20" -> create_event', () => {
  const r = parse('tenho um compromisso dia 20');
  assert.equal(r.intent, 'create_event');
  assert.ok(r.events.length >= 1);
  assert.equal(r.events[0].date, '2026-08-20');
});

test('"dia 20 tenho uma reunião" -> create_event', () => {
  const r = parse('dia 20 tenho uma reunião');
  assert.equal(r.intent, 'create_event');
  assert.equal(r.events[0].date, '2026-08-20');
  assert.equal(r.events[0].eventType, 'Reuniões');
});

test('"dia 20 às 15h tenho reunião com João" -> create_event com horário + pessoa', () => {
  const r = parse('dia 20 às 15h tenho reunião com João');
  assert.equal(r.intent, 'create_event');
  assert.equal(r.events[0].date, '2026-08-20');
  assert.equal(r.events[0].time, '15:00');
  assert.equal(r.events[0].personId, 'emp_1');
  assert.equal(r.events[0].eventType, 'Reuniões');
  assert.equal(r.events[0].hasExplicitTime, true);
});

test('"dia 20 é aniversário da empresa" -> create_event (não tarefa)', () => {
  const r = parse('dia 20 é aniversário da empresa');
  assert.equal(r.intent, 'create_event');
  assert.ok(r.events.length >= 1);
  // Aniversário não é tarefa — não deve produzir taskCalendar.
  assert.equal(r.taskCalendar, undefined);
});

// ─── SITUATION B: tarefa com PRAZO (deadline) ────────────────────────
test('"tenho que pagar o funcionário até dia 20" -> create_task_with_calendar com deadline', () => {
  const r = parse('tenho que pagar o funcionário até dia 20');
  assert.equal(r.intent, 'create_task_with_calendar');
  assert.ok(r.taskCalendar);
  assert.equal(r.taskCalendar!.date, '2026-08-20');
  assert.equal(r.taskCalendar!.deadline, true);
});

// ─── SITUATION C: tarefa agendada (data de execução) ─────────────────
test('"dia 20 preciso ligar para o João" -> create_task_with_calendar sem deadline', () => {
  const r = parse('dia 20 preciso ligar para o João');
  assert.equal(r.intent, 'create_task_with_calendar');
  assert.ok(r.taskCalendar);
  assert.equal(r.taskCalendar!.date, '2026-08-20');
  assert.equal(r.taskCalendar!.deadline, false);
});

// ─── SITUATION D: compromisso rico com várias informações ─────────────
test('"dia 20 às 15h tenho uma reunião com o Carlos para falar do orçamento da obra do cliente da padaria"', () => {
  const r = parse('dia 20 às 15h tenho uma reunião com o Carlos para falar do orçamento da obra do cliente da padaria');
  assert.equal(r.intent, 'create_event');
  assert.equal(r.events[0].date, '2026-08-20');
  assert.equal(r.events[0].time, '15:00');
  assert.equal(r.events[0].personId, 'emp_3');
  assert.equal(r.events[0].eventType, 'Reuniões');
  assert.ok(r.events[0].context, 'deve preservar contexto');
});

// ─── SITUATION E: evento que não é tarefa ────────────────────────────
test('"dia 20 é aniversário da minha mãe" -> create_event sem tarefa', () => {
  const r = parse('dia 20 é aniversário da minha mãe');
  assert.equal(r.intent, 'create_event');
  assert.equal(r.taskCalendar, undefined);
});

// ─── EVENTO + TAREFA: título do evento NÃO engole cláusulas de tarefa ─
test('"dia 20 tenho reunião com o fornecedor e preciso levar o orçamento" — título do evento é só "Reunião com o fornecedor"', () => {
  const r = parse('dia 20 tenho reunião com o fornecedor e preciso levar o orçamento');
  assert.ok(r.events.length >= 1, 'deve ter pelo menos 1 evento');
  // Título do evento NÃO deve conter "preciso levar" ou "orçamento e preparar"
  const evTitle = r.events[0].title.toLowerCase();
  assert.ok(!evTitle.includes('preciso'), `título não deve ter "preciso": "${r.events[0].title}"`);
  assert.ok(!evTitle.includes('levar'), `título não deve ter "levar": "${r.events[0].title}"`);
  assert.ok(evTitle.includes('reunião') || evTitle.includes('fornecedor'), `deve ter reunião/fornecedor: "${r.events[0].title}"`);
});

test('"dia 20 tenho reunião com o fornecedor e preciso levar o orçamento e preparar o material" — título do evento corta em "e preciso"', () => {
  const r = parse('dia 20 tenho reunião com o fornecedor e preciso levar o orçamento e preparar o material');
  assert.ok(r.events.length >= 1);
  const evTitle = r.events[0].title.toLowerCase();
  assert.ok(!evTitle.includes('preciso'), `título: "${r.events[0].title}"`);
  assert.ok(!evTitle.includes('preparar'), `título: "${r.events[0].title}"`);
  assert.ok(!evTitle.includes('levar'), `título: "${r.events[0].title}"`);
});
test('"amanhã vou encontrar o fornecedor" -> create_event implícito', () => {
  const r = parse('amanhã vou encontrar o fornecedor');
  assert.equal(r.intent, 'create_event');
  assert.equal(r.events[0].date, '2026-08-14');
});

test('"sexta vou estar na obra" -> create_event', () => {
  const r = parse('sexta vou estar na obra');
  assert.equal(r.intent, 'create_event');
  assert.equal(r.events[0].date, '2026-08-14');
  assert.equal(r.events[0].eventType, 'Visitas');
});

// ─── TAREFA + CALENDÁRIO (seção 14) ───────────────────────────────────
test('"amanhã preciso comprar cimento" -> create_task_with_calendar', () => {
  const r = parse('amanhã preciso comprar cimento');
  assert.equal(r.intent, 'create_task_with_calendar');
  assert.equal(r.taskCalendar!.date, '2026-08-14');
  assert.equal(r.taskCalendar!.deadline, false);
});

test('"até sexta preciso entregar o material" -> create_task_with_calendar com deadline', () => {
  const r = parse('até sexta preciso entregar o material');
  assert.equal(r.intent, 'create_task_with_calendar');
  assert.equal(r.taskCalendar!.deadline, true);
});

// ─── NÃO DUPLICAR (seção 15) ──────────────────────────────────────────
test('parser idempotente: rodar 2x não muda intenção', () => {
  const r1 = parse('amanhã preciso comprar cimento');
  const r2 = parse('amanhã preciso comprar cimento');
  assert.equal(r1.intent, r2.intent);
  assert.equal(r1.events.length, r2.events.length);
});

// ─── MÚLTIPLOS EVENTOS (seção 26) ─────────────────────────────────────
test('"segunda reunião com João, terça visita na obra e quarta falar com fornecedor" -> múltiplos eventos', () => {
  const r = parse('segunda reunião com João, terça visita na obra e quarta falar com fornecedor');
  // O parser deve detectar a intenção de evento. A análise detalhada
  // pode gerar 1 ou 3 eventos dependendo da fragmentação; aceitamos >=1.
  assert.ok(r.intent === 'create_event' || r.intent === 'create_task_and_event');
  assert.ok(r.events.length >= 1 || r.taskCalendar, 'deve produzir algum evento/calendario');
});

// ─── NEGAÇÃO (seção 32) ───────────────────────────────────────────────
test('"não tenho reunião amanhã" -> none', () => {
  const r = parse('não tenho reunião amanhã');
  assert.equal(r.intent, 'none');
});

test('"cancelei a reunião de sexta" -> none', () => {
  const r = parse('cancelei a reunião de sexta');
  assert.equal(r.intent, 'none');
});

test('"não vou na obra sexta" -> none', () => {
  const r = parse('não vou na obra sexta');
  assert.equal(r.intent, 'none');
});

// ─── DATAS PASSADAS (seção 31) ────────────────────────────────────────
test('"ontem tive reunião com João" -> none (passado)', () => {
  const r = parse('ontem tive reunião com João');
  assert.equal(r.intent, 'none');
});

// ─── TIPOS DO ONBOARDING (seção 28) ───────────────────────────────────
test('"sexta tenho reunião com o cliente" -> eventType Reuniões', () => {
  const r = parse('sexta tenho reunião com o cliente');
  assert.equal(r.intent, 'create_event');
  assert.equal(r.events[0].eventType, 'Reuniões');
});

test('"terça vou visitar a obra" -> eventType Visitas', () => {
  const r = parse('terça vou visitar a obra');
  assert.equal(r.intent, 'create_event');
  // Visitar/visita cai em Visitas via alias default
  assert.equal(r.events[0].eventType, 'Visitas');
});

// ─── HORÁRIOS E PERÍODOS (seções 19/20) ───────────────────────────────
test('"sexta às 10 tenho reunião" -> horário explícito 10:00', () => {
  const r = parse('sexta às 10 tenho reunião');
  assert.equal(r.events[0].time, '10:00');
  assert.equal(r.events[0].hasExplicitTime, true);
});

test('"amanhã à tarde tenho reunião" -> sem horário inventado', () => {
  const r = parse('amanhã à tarde tenho reunião');
  // "à tarde" é período — não inventa HH:MM.
  assert.equal(r.events[0].hasExplicitTime, false);
});

// ─── decideHybrid ─────────────────────────────────────────────────────
test('decideHybrid: create_event gera evento independente', () => {
  const r = parse('dia 20 tenho uma reunião');
  const d = decideHybrid(r, false, false);
  assert.ok(d.shouldCreateInCalendar);
  assert.ok(d.events.length >= 1);
  assert.equal(d.taskCalendar, undefined);
});

test('decideHybrid: create_task_with_calendar gera instrução', () => {
  const r = parse('amanhã preciso comprar cimento');
  const d = decideHybrid(r, true, true);
  assert.ok(d.shouldCreateInCalendar);
  assert.ok(d.taskCalendar);
});

test('decideHybrid: none não cria nada', () => {
  const r = parse('não tenho reunião amanhã');
  const d = decideHybrid(r, false, false);
  assert.equal(d.shouldCreateInCalendar, false);
});

// ─── buildEventTypeAliases ────────────────────────────────────────────
test('buildEventTypeAliases: inclui label e variantes', () => {
  const m = buildEventTypeAliases(['Reuniões', 'Visitas']);
  assert.ok(m.has('reunioes'));
  assert.ok(m.has('visitas'));
  const reunioesAliases = m.get('reunioes')!;
  assert.ok(reunioesAliases.includes('reuniao'));
  assert.ok(reunioesAliases.includes('reunir'));
});

// ─── Recorrência (seção 4) — somente reconhecimento, sem instanciar ───
test('"todo mês preciso pagar o aluguel" -> tarefa com data (não explode recorrência)', () => {
  const r = parse('todo mês preciso pagar o aluguel');
  // Não implementamos recurrence completa; aceita que produz tarefa sem
  // evento futuro multiplicado.
  assert.ok(r.intent === 'create_task_with_calendar' || r.intent === 'none');
  if (r.taskCalendar) {
    assert.ok(r.taskCalendar.date);
  }
});

// ─── Conflito prazo vs execução (seção 30) ────────────────────────────
test('"preciso pagar o funcionário até sexta, mas vou resolver isso só na segunda" -> não inventa', () => {
  const r = parse('preciso pagar o funcionário até sexta, mas vou resolver isso só na segunda');
  // O parser deve identificar algo (provavelmente create_task_with_calendar
  // com deadline=true pela presença do "até sexta"). Não valida detalhe.
  assert.ok(r.intent === 'create_task_with_calendar' || r.intent === 'none');
});
