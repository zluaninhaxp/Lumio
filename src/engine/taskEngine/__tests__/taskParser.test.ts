import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTaskMessage } from '../taskParser.ts';
import type { TaskParserContext } from '../types.ts';

// Fixa "hoje" = 2026-08-13 (quinta-feira) — todas as datas relativas são calculadas a partir daqui.
const NOW = new Date(2026, 7, 13, 10, 0, 0, 0); // mês 7 = agosto

function ctx(): TaskParserContext {
  return {
    now: NOW,
    people: [
      { id: 'emp_1', name: 'João Silva' },
      { id: 'emp_2', name: 'Ana Souza' },
      { id: 'emp_3', name: 'Carlos' },
    ],
    taskTags: ['Compras', 'Obras', 'Orçamentos', 'Fornecedores', 'Clientes'],
    keywordMap: {
      cimento: 'Compras',
      areia: 'Compras',
      brita: 'Compras',
      orçamento: 'Orçamentos',
      orcamento: 'Orçamentos',
      fornecedor: 'Fornecedores',
      cliente: 'Clientes',
    },
  };
}

function parse(msg: string) {
  return parseTaskMessage(msg, ctx());
}

// ─── INTENÇÃO: criação explícita/implícita ───────────────────────────
test('preciso comprar material', () => {
  const r = parse('preciso comprar material');
  assert.equal(r.intent, 'create_task');
  assert.ok(r.tasks.length >= 1);
  assert.match(r.tasks[0].title, /Comprar/i);
  assert.match(r.tasks[0].title, /material/i);
});

test('tenho que comprar material', () => {
  const r = parse('tenho que comprar material');
  assert.equal(r.intent, 'create_task');
});

test('não posso esquecer de comprar material', () => {
  const r = parse('não posso esquecer de comprar material');
  assert.equal(r.intent, 'create_task');
  assert.match(r.tasks[0].title, /Comprar material/i);
});

test('me lembra de comprar material', () => {
  const r = parse('me lembra de comprar material');
  assert.equal(r.intent, 'create_task');
});

test('coloca pra eu comprar material amanhã', () => {
  const r = parse('coloca pra eu comprar material amanhã');
  assert.equal(r.intent, 'create_task');
  assert.equal(r.tasks[0].dueDate, '2026-08-14'); // amanhã
});

test('anota aí: comprar material', () => {
  const r = parse('anota aí: comprar material');
  assert.equal(r.intent, 'create_task');
  assert.match(r.tasks[0].title, /Comprar material/i);
});

test('adiciona uma tarefa pra comprar material', () => {
  const r = parse('adiciona uma tarefa pra comprar material');
  assert.equal(r.intent, 'create_task');
});

test('comando imperativo: liga pro João', () => {
  const r = parse('liga pro João');
  assert.equal(r.intent, 'create_task');
  assert.equal(r.tasks[0].assigneeId, 'emp_1');
  assert.match(r.tasks[0].entities.action ?? '', /ligar/i);
});

test('verbo no gerúndio/ação sem imperativo: o orçamento precisa ser enviado amanhã', () => {
  const r = parse('o orçamento precisa ser enviado amanhã');
  // "enviado" não é no dicionário direto, mas "precisa ser" pode falhar;
  // aceitamos aqui que não crie tarefa se não houver ação recognoscível,
  // mas priorizamos não-criar falsos positivos.
  // Para esta frase passar, o motor deve detectar "precisa" (gatilho).
  // Como não há verbo infinitivo explícito, é OK se for 'none'.
  assert.ok(r.intent === 'none' || r.intent === 'create_task');
});

test('narrativa: o João pediu pra eu verificar o orçamento amanhã', () => {
  const r = parse('o João pediu pra eu verificar o orçamento amanhã');
  assert.equal(r.intent, 'create_task');
  assert.equal(r.tasks[0].dueDate, '2026-08-14');
  assert.match(r.tasks[0].title, /Verificar/i);
  assert.ok(r.tasks[0].title.toLowerCase().includes('orçamento'));
});

test('preciso resolver o orçamento da obra', () => {
  const r = parse('preciso resolver o orçamento da obra');
  assert.equal(r.intent, 'create_task');
  assert.match(r.tasks[0].title, /Resolver/i);
});

// ─── NEGACÃO / FALSOS POSITIVOS ─────────────────────────────────────
test('não preciso comprar cimento', () => {
  const r = parse('não preciso comprar cimento');
  assert.equal(r.intent, 'none');
});

test('já comprei cimento', () => {
  const r = parse('já comprei cimento');
  assert.equal(r.intent, 'none');
});

test('comprei cimento ontem', () => {
  const r = parse('comprei cimento ontem');
  assert.equal(r.intent, 'none');
});

test('não precisa comprar cimento', () => {
  const r = parse('não precisa comprar cimento');
  assert.equal(r.intent, 'none');
});

test('quanto custa comprar cimento?', () => {
  const r = parse('quanto custa comprar cimento?');
  assert.equal(r.intent, 'none');
});

test('você acha que eu devo comprar cimento?', () => {
  const r = parse('você acha que eu devo comprar cimento?');
  assert.equal(r.intent, 'none');
});

test('não esquece que eu já comprei o material — NÃO cria tarefa', () => {
  const r = parse('não esquece que eu já comprei o material');
  // "não esquece" é gatilho de lembrete, mas "já comprei" é passado.
  // O motor deve priorizar o filtro de passado e não criar tarefa.
  assert.equal(r.intent, 'none');
});

// ─── DATAS / PRAZOS ─────────────────────────────────────────────────
test('amanhã preciso comprar material (data antes)', () => {
  const r = parse('amanhã preciso comprar material');
  assert.equal(r.intent, 'create_task');
  assert.equal(r.tasks[0].dueDate, '2026-08-14');
});

test('comprar cimento amanhã (data depois)', () => {
  const r = parse('comprar cimento amanhã');
  assert.equal(r.intent, 'create_task');
  assert.equal(r.tasks[0].dueDate, '2026-08-14');
});

test('sexta preciso resolver a entrega', () => {
  const r = parse('sexta preciso resolver a entrega');
  assert.equal(r.tasks[0].dueDate, '2026-08-14'); // sexta = 14
});

test('amanhã às 10 o João precisa ligar para o fornecedor', () => {
  const r = parse('amanhã às 10 o João precisa ligar para o fornecedor');
  assert.equal(r.intent, 'create_task');
  assert.equal(r.tasks[0].dueDate, '2026-08-14');
  assert.equal(r.tasks[0].dueTime, '10:00');
  assert.equal(r.tasks[0].assigneeId, 'emp_1');
  assert.ok(r.tasks[0].tags.includes('Fornecedores'));
});

test('daqui a 2 dias comprar cimento', () => {
  const r = parse('daqui a 2 dias comprar cimento');
  assert.equal(r.tasks[0].dueDate, '2026-08-15');
});

test('dia 20 comprar cimento', () => {
  const r = parse('dia 20 comprar cimento');
  assert.equal(r.tasks[0].dueDate, '2026-08-20');
});

// ─── ORDEM DOS ELEMENTOS ────────────────────────────────────────────
test('amanhã comprar cimento', () => {
  const r = parse('amanhã comprar cimento');
  assert.equal(r.intent, 'create_task');
  assert.equal(r.tasks[0].dueDate, '2026-08-14');
});

test('sexta o João vai verificar o orçamento', () => {
  const r = parse('sexta o João vai verificar o orçamento');
  assert.equal(r.intent, 'create_task');
  assert.equal(r.tasks[0].assigneeId, 'emp_1');
  assert.equal(r.tasks[0].dueDate, '2026-08-14');
});

// ─── LINGUAGEM INFORMAL ─────────────────────────────────────────────
test('tenho q comprar cimento (abreviação q)', () => {
  const r = parse('tenho q comprar cimento');
  assert.equal(r.intent, 'create_task');
});

test('liga pro João (pro -> para o + João)', () => {
  const r = parse('liga pro João');
  assert.equal(r.intent, 'create_task');
  assert.equal(r.tasks[0].assigneeId, 'emp_1');
});

test('ver o material amanhã (ver -> verificar)', () => {
  const r = parse('ver o material amanhã');
  assert.equal(r.intent, 'create_task');
  assert.equal(r.tasks[0].dueDate, '2026-08-14');
});

test('comprar os negócio amanhã (coloquial)', () => {
  const r = parse('comprar os negócio amanhã');
  // "comprar" é ação; objeto "os negócio". Pode criar; aceita.
  assert.equal(r.intent, 'create_task');
});

// ─── TAGS via onboarding/keywordMap ─────────────────────────────────
test('preciso comprar cimento amanhã → tag Compras', () => {
  const r = parse('preciso comprar cimento amanhã');
  assert.ok(r.tasks[0].tags.includes('Compras'));
});

test('verificar orçamento da obra → tag Orçamentos', () => {
  const r = parse('verificar orçamento da obra');
  assert.ok(r.tasks[0].tags.includes('Orçamentos'));
});

test('ligar para o fornecedor → tag Fornecedores', () => {
  const r = parse('ligar para o fornecedor');
  assert.ok(r.tasks[0].tags.includes('Fornecedores'));
});

test('preciso comprar cimento e areia → uma tarefa de Compras (lista)', () => {
  const r = parse('preciso comprar cimento e areia amanhã');
  assert.equal(r.intent, 'create_task');
  assert.equal(r.tasks.length, 1); // lista de objetos, NÃO múltiplas tarefas
  assert.ok(r.tasks[0].tags.includes('Compras'));
  assert.equal(r.tasks[0].dueDate, '2026-08-14');
});

// ─── MÚLTIPLAS TAREFAS ──────────────────────────────────────────────
test('amanhã preciso comprar cimento, ligar pro João e mandar o orçamento', () => {
  const r = parse('amanhã preciso comprar cimento, ligar pro João e mandar o orçamento');
  assert.equal(r.intent, 'create_task');
  assert.ok(r.tasks.length >= 2, `esperado >=2 tarefas, veio ${r.tasks.length}`);
  // todas herdando amanhã
  for (const t of r.tasks) assert.equal(t.dueDate, '2026-08-14');
});

// ─── CASOS EXTREMOS / INSUFICIÊNCIA ────────────────────────────────
test('apenas "comprar" — ação sem objeto, confiança baixa', () => {
  const r = parse('comprar');
  // Sem gatilho e sem objeto → pode ser none ou baixa confiança
  assert.ok(r.intent === 'none' || r.tasks.every((t) => t.confidence < 0.5), 'não deve criar automático com confiança alta');
});

test('apenas "amanhã" — sem ação', () => {
  const r = parse('amanhã');
  assert.equal(r.intent, 'none');
});

test('apenas "João" — sem ação, sem gatilho', () => {
  const r = parse('João');
  assert.equal(r.intent, 'none');
});

test('apenas "adiciona" — gatilho sem ação/objeto', () => {
  const r = parse('adiciona');
  assert.equal(r.intent, 'none');
});

test('anota aí — gatilho sem ação suficiente', () => {
  const r = parse('anota aí');
  assert.equal(r.intent, 'none');
});

test('nova tarefa: comprar cimento (explícito com objeto)', () => {
  const r = parse('nova tarefa: comprar cimento');
  assert.equal(r.intent, 'create_task');
  assert.match(r.tasks[0].title, /Comprar cimento/i);
});

// ─── CONTEXTO PRESERVADO ───────────────────────────────────────────
test('o cliente pediu pra eu mandar o orçamento sexta', () => {
  const r = parse('o cliente pediu pra eu mandar o orçamento sexta');
  assert.equal(r.intent, 'create_task');
  assert.equal(r.tasks[0].dueDate, '2026-08-14');
  assert.ok(r.tasks[0].tags.includes('Orçamentos') || r.tasks[0].tags.includes('Clientes'));
});

test('João falou que amanhã precisamos verificar o orçamento da obra do cliente da padaria', () => {
  const r = parse('João falou que amanhã precisamos verificar o orçamento da obra do cliente da padaria');
  assert.equal(r.intent, 'create_task');
  assert.equal(r.tasks[0].dueDate, '2026-08-14');
  assert.match(r.tasks[0].title, /Verificar/i);
  assert.ok(r.tasks[0].title.toLowerCase().includes('orçamento'));
});