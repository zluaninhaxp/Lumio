/**
 * Testes de INTEGRAÇÃO Chat → Financeiro → Tela (seções 44-47).
 *
 * Exercita o pipeline REAL com um store espelho: parser -> payload ->
 * "persistência" (store fake com a mesma forma do zustand) -> asserts
 * que espelham a leitura da tela Financeiro (`useFinanceState`) e a
 * orquestração de obrigações (tarefa + calendário + vínculo).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFinancialMessage } from '../financialParser.ts';
import { applyFinancialAmbiguity, applyFinancialResult, buildFinanceCards } from '../financialOrchestrator.ts';
import { entryToTransactionPayload, buildFinancialBotText } from '../apply.ts';
import { answerFinancialQuery } from '../queryAnswer.ts';
import type { FinancialParserContext } from '../types.ts';
import { recordLearnedIntentMarker } from '../../taxonomy/entityResolver.ts';
import type { LearnedIntentMarker } from '../../taxonomy/types.ts';
// Tipos estruturais espelhando o store real (importar `src/store/index.ts`
// traria zustand/expo para o runner de testes — mantemos o teste puro).
interface Tx {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  clientId?: string;
  supplierId?: string;
  supplierDueDate?: string;
  supplierPaid?: boolean;
  expectedDate?: string;
  confirmed?: boolean;
  taskId?: string;
}
interface TaskLike {
  id: string;
  description: string;
  done: boolean;
  dueDate: string | null;
  priority: 'alta' | 'media' | 'baixa';
  subtasks: { id: string; text: string; done: boolean }[];
  tags: string[];
  createdAt: string;
  calendarEventId?: string;
  financeTransactionId?: string;
}
interface EventLike {
  id: string;
  date: string;
  time: string | null;
  description: string;
  done: boolean;
  type: 'event' | 'task';
  taskId?: string;
  source?: 'manual' | 'chat' | 'task';
  deadline?: boolean;
}

const NOW = new Date(2026, 7, 13, 10, 0, 0, 0); // qui 13/08/2026

function ctx(learnedIntentMarkers: LearnedIntentMarker[] = []): FinancialParserContext {
  return {
    now: NOW,
    expenseCategories: ['Material', 'Combustível', 'Funcionários', 'Fornecedores'],
    incomeCategories: ['Vendas'],
    keywordMap: { gasolina: 'Combustível', cimento: 'Material', salário: 'Funcionários' },
    clients: [{ id: 'cli_1', name: 'João' }],
    suppliers: [{ id: 'sup_1', name: 'Casa do Cimento', paymentTerm: '30 dias' }],
    employees: [{ id: 'emp_1', name: 'Carlos' }],
    businessProfile: { learnedIntentMarkers },
  };
}

test('ambiguidade financeira aprende a direção e resolve a próxima mensagem', () => {
  const store = makeStore();
  const learnedIntentMarkers: LearnedIntentMarker[] = [];
  const first = parseFinancialMessage('me fizeram um pix de 50 reais', ctx(learnedIntentMarkers));
  assert.equal(first.ambiguity?.candidatePhrase, 'me fizeram um pix');
  assert.equal(first.ambiguity?.partialData.amount, 50);
  assert.equal(store.state.transactions.length, 0);
  console.log('1. pergunta:', first.ambiguity?.type, first.ambiguity?.candidatePhrase);

  applyFinancialAmbiguity(first.ambiguity!, 'IN_REALIZED', store);
  recordLearnedIntentMarker({ learnedIntentMarkers }, 'financial', first.ambiguity!.candidatePhrase!, 'IN_REALIZED');
  assert.equal(store.state.transactions[0].amount, 50);
  assert.equal(learnedIntentMarkers[0].phrase, 'me fizeram um pix');
  assert.equal(learnedIntentMarkers[0].resolution, 'IN_REALIZED');
  assert.equal(learnedIntentMarkers[0].occurrences, 1);
  console.log('2. resposta:', 'Eu recebi', '-> entrada R$ 50');

  const second = parseFinancialMessage('me fizeram um pix de 80 reais', ctx(learnedIntentMarkers));
  assert.equal(second.ambiguity, null);
  assert.equal(second.intent, 'create_transaction');
  assert.equal(second.entries[0].direction, 'income');
  assert.equal(second.entries[0].amount, 80);
  console.log('3. próxima mensagem:', 'entrada R$ 80 sem ambiguidade');
});

/** Store espelho com a interface mínima do zustand. */
function makeStore() {
  const state: { transactions: Tx[]; tasks: TaskLike[]; events: EventLike[] } = {
    transactions: [], tasks: [], events: [],
  };
  let seq = 0;
  const id = (p: string) => `${p}${++seq}`;
  return {
    state,
    addTransaction: (t: Omit<Tx, 'id'>) => {
      const tid = id('txn_');
      state.transactions.unshift({ ...t, id: tid });
      return tid;
    },
    addTask: (t: Omit<TaskLike, 'id'>) => {
      const tid = id('task_');
      state.tasks.unshift({ ...t, id: tid });
      return tid;
    },
    calendarizeTask: (taskId: string, opts: { date: string; deadline?: boolean }) => {
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task || task.calendarEventId) return false;
      const evId = id('cal_task_');
      state.events.push({ id: evId, date: opts.date, time: null, description: task.description, done: false, type: 'task', taskId, source: 'task', deadline: opts.deadline ? true : undefined });
      task.calendarEventId = evId;
      return true;
    },
    linkTaskToTransaction: (taskId: string, transactionId: string) => {
      const task = state.tasks.find((t) => t.id === taskId);
      const tx = state.transactions.find((t) => t.id === transactionId);
      if (!task || !tx) return;
      task.financeTransactionId = transactionId;
      tx.taskId = taskId;
    },
  };
}

// ═══ FLUXO 1: entrada realizada (seção 44/45) ══════════════════════
test('CHAT→FINANCEIRO: "recebi 500 do João" aparece correto na "tela"', () => {
  const store = makeStore();
  const r = parseFinancialMessage('recebi 500 do João', ctx());
  applyFinancialResult(r, store);

  assert.equal(store.state.transactions.length, 1);
  const tx = store.state.transactions[0];
  assert.equal(tx.amount, 500);                    // entrada positiva
  assert.equal(tx.clientId, 'cli_1');              // contraparte resolvida
  assert.equal(tx.date, '13/08');                  // hoje em DD/MM (formato da tela)
  assert.ok(tx.description.length > 0);
  assert.equal(tx.confirmed, undefined);           // realizada (não prevista)

  // Tela: soma de entradas do mês
  const entradas = store.state.transactions.filter((t) => t.amount > 0 && t.confirmed !== false).reduce((s, t) => s + t.amount, 0);
  assert.equal(entradas, 500);
});

test('CHAT→FINANCEIRO: "fizeram um pagamento de 30 reais" cria entrada', () => {
  const store = makeStore();
  const r = parseFinancialMessage('fizeram um pagamento de 30 reais', ctx());
  applyFinancialResult(r, store);

  assert.equal(r.intent, 'create_transaction');
  assert.equal(store.state.transactions.length, 1);
  assert.equal(store.state.transactions[0].amount, 30);
  assert.equal(store.state.transactions[0].date, '13/08');
});

test('CHAT→FINANCEIRO: "paguei 500 de gasolina" sai negativo com categoria', () => {
  const store = makeStore();
  const r = parseFinancialMessage('paguei 500 de gasolina', ctx());
  applyFinancialResult(r, store);

  const tx = store.state.transactions[0];
  assert.equal(tx.amount, -500);
  assert.equal(tx.category, 'Combustível');        // keywordMap do onboarding
  // Tela: saídas do mês
  const saidas = store.state.transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  assert.equal(saidas, 500);
});

// ═══ FLUXO 2: obrigação futura (seção 25/26/46) ════════════════════
test('OBRIGAÇÃO: "preciso pagar o funcionário 2000 até sexta" -> tarefa+financeiro+calendário vinculados', () => {
  const store = makeStore();
  const r = parseFinancialMessage('preciso pagar o funcionário 2000 até sexta', ctx());
  assert.equal(r.intent, 'create_obligation');
  const applied = applyFinancialResult(r, store);

  // FINANCIAL: despesa pendente
  assert.equal(store.state.transactions.length, 1);
  const tx = store.state.transactions[0];
  assert.equal(tx.amount, -2000);
  assert.equal(tx.supplierPaid, false);            // pendente (padrão fornecedores)
  assert.equal(tx.supplierDueDate, '2026-08-14');  // sexta
  // Pendência NÃO entra no saldo realizado
  const saldo = store.state.transactions.filter((t) => t.amount < 0 && t.supplierPaid !== false).reduce((s, t) => s + t.amount, 0);
  assert.equal(saldo, 0);

  // TASK criada e vinculada
  assert.ok(applied.taskId);
  const task = store.state.tasks[0];
  assert.equal(task.id, applied.taskId);
  assert.equal(task.dueDate, '2026-08-14');
  assert.ok(/pagar/i.test(task.description));
  assert.equal(task.financeTransactionId, tx.id);  // bidirecional
  assert.equal(tx.taskId, task.id);

  // CALENDAR: evento derivado (deadline)
  const ev = store.state.events[0];
  assert.equal(ev.taskId, task.id);
  assert.equal(ev.source, 'task');
  assert.equal(ev.date, '2026-08-14');
  assert.equal(ev.deadline, true);

  // Concluir a tarefa NÃO apaga o lançamento (seção 46)
  task.done = true;
  assert.ok(store.state.transactions.some((t) => t.id === tx.id));
});

// ═══ FLUXO 3: receita futura não é dinheiro recebido (seção 17) ════
test('"o cliente vai me pagar 800 amanhã" -> prevista, fora do saldo', () => {
  const store = makeStore();
  const r = parseFinancialMessage('o cliente vai me pagar 800 amanhã', ctx());
  applyFinancialResult(r, store);

  const tx = store.state.transactions[0];
  assert.equal(tx.amount, 800);
  assert.equal(tx.confirmed, false);               // padrão contratos (prevista)
  assert.equal(tx.expectedDate, '2026-08-14');
  // Tela: entradas REALIZADAS não incluem previstas
  const entradas = store.state.transactions.filter((t) => t.amount > 0 && t.confirmed !== false).reduce((s, t) => s + t.amount, 0);
  assert.equal(entradas, 0);
});

// ═══ FLUXO 4: múltiplos lançamentos (seção 34/35) ══════════════════
test('"hoje paguei 500 de gasolina e 300 de material" -> 2 lançamentos categorizados', () => {
  const store = makeStore();
  const r = parseFinancialMessage('hoje paguei 500 de gasolina e 300 de material', ctx());
  applyFinancialResult(r, store);

  assert.equal(store.state.transactions.length, 2);
  const cats = store.state.transactions.map((t) => t.category).sort();
  assert.deepEqual(cats, ['Combustível', 'Material']);
  const total = store.state.transactions.reduce((s, t) => s + Math.abs(t.amount), 0);
  assert.equal(total, 800); // 500+300, NÃO um único 800
});

// ═══ FLUXO 5: consultas com dados reais (seção 30) ═════════════════
test('CONSULTA: responde com números do store, sem mock', () => {
  const store = makeStore();
  applyFinancialResult(parseFinancialMessage('paguei 300 de gasolina', ctx()), store);
  applyFinancialResult(parseFinancialMessage('recebi 1000 do João', ctx()), store);
  applyFinancialResult(parseFinancialMessage('vou pagar 200 pro fornecedor amanhã', ctx()), store);

  const q = parseFinancialMessage('quanto eu gastei esse mês?', ctx());
  assert.equal(q.intent, 'query');
  const answer = answerFinancialQuery(q.query!, store.state.transactions, NOW);
  assert.match(answer, /300/);
  assert.match(answer, /Combustível/);
  assert.ok(!answer.includes('1.640')); // mock morto

  const q2 = parseFinancialMessage('quanto tenho para pagar?', ctx());
  const a2 = answerFinancialQuery(q2.query!, store.state.transactions, NOW);
  assert.match(a2, /200/); // só a pendência, não as realizadas

  const q3 = parseFinancialMessage('quanto tenho para receber?', ctx());
  const a3 = answerFinancialQuery(q3.query!, store.state.transactions, NOW);
  assert.match(a3, /não tem/i); // nada a receber
});

// ═══ FLUXO 6: negação nunca persiste (seção 22) ════════════════════
test('NEGAÇÃO: "não paguei o fornecedor" não cria nada', () => {
  const store = makeStore();
  const r = parseFinancialMessage('não paguei o fornecedor', ctx());
  applyFinancialResult(r, store);
  assert.equal(store.state.transactions.length, 0);
  assert.equal(store.state.tasks.length, 0);
});

// ═══ FLUXO 7: valor ausente nunca inventa (seção 32) ═══════════════
test('INCOMPLETE: "paguei o João" não cria lançamento', () => {
  const store = makeStore();
  const r = parseFinancialMessage('paguei o João', ctx());
  assert.equal(r.intent, 'incomplete');
  applyFinancialResult(r, store);
  assert.equal(store.state.transactions.length, 0);
});

// ═══ FLUXO 8: recência/não-duplicação ══════════════════════════════
test('Aplicar 2x a MESMA interpretação gera 2 lançamentos distintos (sem mecanismo de idempotência por mensagem — fora de escopo do parser)', () => {
  const store = makeStore();
  const r = parseFinancialMessage('paguei 100', ctx());
  applyFinancialResult(r, store);
  applyFinancialResult(r, store);
  // O parser é stateless; a deduplicação por messageId ficaria na camada
  // de mensagens (não existe persistência de chat ainda). Documentado.
  assert.equal(store.state.transactions.length, 2);
});

// ═══ FLUXO 9: payload/bot text ═════════════════════════════════════
test('entryToTransactionPayload: formatos da tela', () => {
  const r = parseFinancialMessage('paguei 1500 no pix', ctx());
  const payload = entryToTransactionPayload(r.entries[0]);
  assert.equal(payload.amount, -1500);
  assert.equal(payload.date, '13/08');
  assert.equal(payload.category, 'Sem categoria');  // sem inventar categoria
});

test('buildFinancialBotText reflete exatamente o registrado', () => {
  const r = parseFinancialMessage('recebi 500 do João', ctx());
  const text = buildFinancialBotText(r.entries);
  assert.match(text, /Entrada/);
  assert.match(text, /500/);
  assert.match(text, /João/);
});

test('buildFinanceCards: card com valor/direção/pendência', () => {
  const r = parseFinancialMessage('vou pagar 300 amanhã', ctx());
  const [card] = buildFinanceCards(r.entries);
  assert.equal(card.kind, 'finance');
  assert.equal(card.amount, 300);
  assert.equal(card.direction, 'expense');
  assert.equal(card.pending, true);
});
