/**
 * Testes do parser financeiro — direção, tempo, categoria, contraparte,
 * negação, consultas, edição, recorrência, múltiplas movimentações.
 * Fixa "hoje" = 2026-08-13 (quinta-feira).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFinancialMessage, detectDirectionAndTense } from '../financialParser.ts';
import type { FinancialParserContext } from '../types.ts';
import type { GenericNode } from '../../taxonomy/types.ts';
import type { LearnedIntentMarker } from '../../taxonomy/types.ts';

const NOW = new Date(2026, 7, 13, 10, 0, 0, 0); // 2026-08-13 quinta

function ctx(overrides: Partial<FinancialParserContext> = {}): FinancialParserContext {
  return {
    now: NOW,
    expenseCategories: ['Material', 'Combustível', 'Funcionários', 'Fornecedores', 'Alimentação'],
    incomeCategories: ['Vendas', 'Serviços'],
    keywordMap: {
      cimento: 'Material', areia: 'Material', gasolina: 'Combustível',
      diesel: 'Combustível', 'salário': 'Funcionários', salario: 'Funcionários',
    },
    clients: [{ id: 'cli_1', name: 'João Padaria' }, { id: 'cli_2', name: 'Maria Construções' }],
    suppliers: [{ id: 'sup_1', name: 'Casa do Cimento', paymentTerm: '30 dias' }],
    employees: [{ id: 'emp_1', name: 'Carlos Souza' }],
    ...overrides,
  };
}

function parse(msg: string, overrides: Partial<FinancialParserContext> = {}) {
  return parseFinancialMessage(msg, ctx(overrides));
}

const financialTaxonomy: GenericNode[] = [{
  id: 'material',
  generic: { label: 'Material', synonyms: ['materiais'] },
  specifics: [],
}];

test('marca categoria financeira não resolvida apenas com taxonomy', () => {
  const unresolved = parse('gastei 300 de gizmo', { taxonomy: financialTaxonomy });
  assert.match(unresolved.entries[0].unresolvedTaxonomyTerm ?? '', /gastei 300 de gizmo/);
  const resolved = parse('gastei 300 de material', { taxonomy: financialTaxonomy });
  assert.equal(resolved.entries[0].unresolvedTaxonomyTerm, null);
  assert.equal(parse('gastei 300 de gizmo').entries[0].unresolvedTaxonomyTerm, null);
});

// ═══ ENTRADAS (seção 28) ═══════════════════════════════════════════
test('"recebi 500" -> entrada realizada', () => {
  const r = parse('recebi 500');
  assert.equal(r.intent, 'create_transaction');
  const e = r.entries[0];
  assert.equal(e.direction, 'income');
  assert.equal(e.tense, 'realized');
  assert.equal(e.amount, 500);
  assert.equal(e.status, 'received');
});

test('"entrou 500"', () => {
  const r = parse('entrou 500');
  assert.equal(r.entries[0].direction, 'income');
});

test('"recebi R$ 1.500 do João" -> contraparte João (cliente real)', () => {
  const r = parse('recebi R$ 1.500 do João');
  const e = r.entries[0];
  assert.equal(e.amount, 1500);
  assert.equal(e.counterpartyName, 'João Padaria');
  assert.equal(e.counterpartyClientId, 'cli_1');
});

test('"o cliente pagou 800" -> entrada (3ª pessoa)', () => {
  const r = parse('o cliente pagou 800');
  assert.equal(r.intent, 'create_transaction');
  assert.equal(r.entries[0].direction, 'income');
  assert.equal(r.entries[0].status, 'received');
});

test('reaproveita a direção aprendida quando a nova frase contém só o termo-chave', () => {
  const learnedIntentMarkers: LearnedIntentMarker[] = [{
    phrase: 'tomei um calote', domain: 'financial', resolution: 'OUT_REALIZED', occurrences: 1, lastSeenAt: NOW.toISOString(),
  }];
  const result = parse('calote de 40 reais', { businessProfile: { learnedIntentMarkers } });
  assert.equal(result.ambiguity, null);
  assert.equal(result.intent, 'create_transaction');
  assert.equal(result.entries[0].direction, 'expense');
  assert.equal(result.entries[0].amount, 40);
});

test('não deixa o token genérico pix herdar entrada em uma frase de saída', () => {
  const learnedIntentMarkers: LearnedIntentMarker[] = [{
    phrase: 'me fizeram um pix', domain: 'financial', resolution: 'IN_REALIZED', occurrences: 1, lastSeenAt: NOW.toISOString(),
  }];
  const result = parse('fiz um pix de 40 reais', { businessProfile: { learnedIntentMarkers } });
  assert.equal(result.ambiguity, null);
  assert.equal(result.intent, 'create_transaction');
  assert.equal(result.entries[0].direction, 'expense');
  assert.equal(result.entries[0].amount, 40);
});

test('distingue transferi de transferiram para mim', () => {
  const outgoing = parse('transferi 20 reais');
  assert.equal(outgoing.intent, 'create_transaction');
  assert.equal(outgoing.entries[0].direction, 'expense');

  const incoming = parse('transferiram 30 reais pra mim');
  assert.equal(incoming.intent, 'create_transaction');
  assert.equal(incoming.entries[0].direction, 'income');
  assert.equal(incoming.entries[0].amount, 30);
});

test('mantém a intenção pendente para completar o valor na mensagem seguinte', () => {
  const pending = parse('recebi um pagamento');
  assert.equal(pending.intent, 'incomplete');
  assert.equal(pending.entries[0].direction, 'income');

  const completed = parse(`${pending.originalText} 32 reais`);
  assert.equal(completed.intent, 'create_transaction');
  assert.equal(completed.entries[0].direction, 'income');
  assert.equal(completed.entries[0].amount, 32);

});

test('pergunta o valor para toda direção reconhecida, realizada ou futura', () => {
  for (const message of ['me fizeram um pix', 'fiz um pix', 'vou fazer um pix']) {
    const result = parse(message, {
      businessProfile: {
        learnedIntentMarkers: message.startsWith('me fizeram') ? [{
          phrase: 'me fizeram um pix', domain: 'financial', resolution: 'IN_REALIZED', occurrences: 1, lastSeenAt: NOW.toISOString(),
        }] : [],
      },
    });
    assert.equal(result.intent, 'incomplete', message);
    assert.equal(result.entries.length, 1, message);
  }
});

test('"fizeram um pagamento de 30 reais" -> entrada realizada', () => {
  const r = parse('fizeram um pagamento de 30 reais');
  assert.equal(r.intent, 'create_transaction');
  assert.equal(r.entries[0].direction, 'income');
  assert.equal(r.entries[0].amount, 30);
  assert.equal(r.entries[0].status, 'received');
});

test('"o cliente me pagou 800"', () => {
  const r = parse('o cliente me pagou 800');
  assert.equal(r.entries[0].direction, 'income');
});

test('"vendi por 2000"', () => {
  const r = parse('vendi por 2000');
  assert.equal(r.entries[0].direction, 'income');
  assert.equal(r.entries[0].amount, 2000);
});

test('"ganhei 30 reais" -> entrada realizada', () => {
  const r = parse('ganhei 30 reais');
  assert.equal(r.intent, 'create_transaction');
  assert.equal(r.entries[0].direction, 'income');
  assert.equal(r.entries[0].amount, 30);
});

test('"caiu 2 mil hoje"', () => {
  const r = parse('caiu 2 mil hoje');
  assert.equal(r.entries[0].amount, 2000);
  assert.equal(r.entries[0].direction, 'income');
});

test('"recebi 800 ontem do Carlos" -> data retroativa', () => {
  const r = parse('recebi 800 ontem do Carlos');
  assert.equal(r.entries[0].transactionDate, '2026-08-12');
});

// ═══ SAÍDAS (seção 28) ═════════════════════════════════════════════
test('"paguei 500" -> saída realizada', () => {
  const r = parse('paguei 500');
  const e = r.entries[0];
  assert.equal(e.direction, 'expense');
  assert.equal(e.tense, 'realized');
  assert.equal(e.amount, 500);
  assert.equal(e.status, 'paid');
});

test('"gastei 300"', () => {
  assert.equal(parse('gastei 300').entries[0].direction, 'expense');
});

test('"comprei material por 400" -> categoria Material', () => {
  const r = parse('comprei material por 400');
  const e = r.entries[0];
  assert.equal(e.direction, 'expense');
  assert.equal(e.amount, 400);
  assert.equal(e.category, 'Material');
});

test('"paguei o fornecedor 1500"', () => {
  const r = parse('paguei o fornecedor 1500');
  assert.equal(r.entries[0].direction, 'expense');
  assert.equal(r.entries[0].counterpartyName, 'Fornecedor');
});

// ═══ FUTURO (seções 16/17/28) ═════════════════════════════════════
test('"vou pagar 500 amanhã" -> obrigação pendente', () => {
  const r = parse('vou pagar 500 amanhã');
  assert.equal(r.intent, 'create_obligation');
  const e = r.entries[0];
  assert.equal(e.direction, 'expense');
  assert.equal(e.tense, 'future');
  assert.equal(e.amount, 500);
  assert.equal(e.dueDate, '2026-08-14');
  assert.equal(e.status, 'pending');
  assert.equal(e.transactionDate, null);
});

test('"tenho que pagar 500 sexta" -> obrigação', () => {
  const r = parse('tenho que pagar 500 sexta');
  assert.equal(r.intent, 'create_obligation');
  // próxima sexta a partir de qui 13/08 = 14/08
  assert.equal(r.entries[0].dueDate, '2026-08-14');
});

test('"o cliente vai pagar 1000 amanhã" -> receita prevista', () => {
  const r = parse('o cliente vai pagar 1000 amanhã');
  assert.equal(r.intent, 'create_obligation');
  const e = r.entries[0];
  assert.equal(e.direction, 'income');
  assert.equal(e.tense, 'future');
  assert.equal(e.status, 'pending');
});

test('"tenho uma conta de 300 vencendo dia 20" -> despesa futura', () => {
  const r = parse('tenho uma conta de 300 vencendo dia 20');
  assert.equal(r.intent, 'create_obligation');
  const e = r.entries[0];
  assert.equal(e.direction, 'expense');
  assert.equal(e.dueDate, '2026-08-20');
  assert.equal(e.amount, 300);
});

test('"João vai me pagar 500 amanhã" -> entrada prevista', () => {
  const r = parse('João vai me pagar 500 amanhã');
  const e = r.entries[0];
  assert.equal(e.direction, 'income');
  assert.equal(e.tense, 'future');
});

test('"tenho para receber 2 mil dia 20"', () => {
  const r = parse('tenho para receber 2 mil dia 20');
  const e = r.entries[0];
  assert.equal(e.direction, 'income');
  assert.equal(e.amount, 2000);
  assert.equal(e.dueDate, '2026-08-20');
});

// ═══ CATEGORIAS (seções 10-12) ════════════════════════════════════
test('"gastei 300 de gasolina" -> Combustível (keywordMap)', () => {
  const r = parse('gastei 300 de gasolina');
  assert.equal(r.entries[0].category, 'Combustível');
});

test('"paguei 500 de material" -> Material (label direto)', () => {
  const r = parse('paguei 500 de material');
  assert.equal(r.entries[0].category, 'Material');
});

test('"paguei 2000 de salário" -> Funcionários', () => {
  const r = parse('paguei 2000 de salário');
  assert.equal(r.entries[0].category, 'Funcionários');
});

test('"comprei cimento por 450" -> Material (keyword)', () => {
  const r = parse('comprei cimento por 450');
  assert.equal(r.entries[0].category, 'Material');
});

test('"gastei 200 reais" -> SEM categoria (não inventa)', () => {
  const r = parse('gastei 200 reais');
  assert.equal(r.entries[0].category, null);
});

// ═══ DATAS EFETIVAS vs VENCIMENTO (seção 15) ══════════════════════
test('"paguei ontem" -> transactionDate retroativo', () => {
  const r = parse('paguei 100 ontem');
  assert.equal(r.entries[0].transactionDate, '2026-08-12');
  assert.equal(r.entries[0].dueDate, null);
});

test('"paguei hoje" -> hoje', () => {
  const r = parse('paguei 100 hoje');
  assert.equal(r.entries[0].transactionDate, '2026-08-13');
});

test('"recebi há dois dias" -> 2026-08-11', () => {
  const r = parse('recebi 100 há dois dias');
  assert.equal(r.entries[0].transactionDate, '2026-08-11');
});

// ═══ NÃO-FINANCEIRO (seção 3) ═════════════════════════════════════
test('"tenho reunião dia 20" -> none', () => {
  assert.equal(parse('tenho reunião dia 20').intent, 'none');
});

test('"comprar 10 sacos de cimento" -> none (sem valor/intenção)', () => {
  // tarefa de compra, não lançamento
  assert.equal(parse('comprar 10 sacos de cimento').intent, 'none');
});

test('"ligar para João às 15h" -> none', () => {
  assert.equal(parse('ligar para joão às 15h').intent, 'none');
});

// ═══ NEGAÇÃO (seção 22) ═══════════════════════════════════════════
test('"não paguei o fornecedor" -> none', () => {
  assert.equal(parse('não paguei o fornecedor').intent, 'none');
});

test('"não recebi ainda" -> none', () => {
  assert.equal(parse('não recebi ainda').intent, 'none');
});

test('"não gastei nada" -> none', () => {
  assert.equal(parse('não gastei nada').intent, 'none');
});

test('"não vou pagar amanhã" -> none', () => {
  assert.equal(parse('não vou pagar amanhã').intent, 'none');
});

// ═══ PASSADO vs FUTURO (seções 23/24) ═════════════════════════════
test('"já paguei" -> realizado', () => {
  const r = parse('já paguei 300');
  assert.equal(r.entries[0].tense, 'realized');
});

// ═══ AMBIGUIDADE (seções 27/32) ═══════════════════════════════════
test('"paguei o João" (sem valor) -> incomplete', () => {
  const r = parse('paguei o João');
  assert.equal(r.intent, 'incomplete');
});

test('"João me pagou" (sem valor) -> incomplete', () => {
  const r = parse('João me pagou');
  assert.equal(r.intent, 'incomplete');
});

test('"gastei muito ontem" (sem valor) -> incomplete', () => {
  const r = parse('gastei muito ontem');
  assert.equal(r.intent, 'incomplete');
});

test('"preciso cobrar o João de 800 reais" -> tarefa, não entrada (none)', () => {
  const r = parse('preciso cobrar o João de 800 reais');
  assert.equal(r.intent, 'none');
});

// ═══ MÚLTIPLAS MOVIMENTAÇÕES (seções 34/35) ═══════════════════════
test('"paguei 500 de gasolina e 300 de material" -> 2 lançamentos', () => {
  const r = parse('hoje paguei 500 de gasolina e 300 de material');
  assert.equal(r.intent, 'create_transaction');
  assert.equal(r.entries.length, 2);
  assert.equal(r.entries[0].amount, 500);
  assert.equal(r.entries[0].category, 'Combustível');
  assert.equal(r.entries[1].amount, 300);
  assert.equal(r.entries[1].category, 'Material');
});

test('"recebi 1000 do João e 500 da Maria" -> 2 entradas', () => {
  const r = parse('recebi 1000 do João e 500 da Maria');
  assert.equal(r.entries.length, 2);
  assert.equal(r.entries[0].direction, 'income');
  assert.equal(r.entries[1].amount, 500);
  assert.equal(r.entries[1].counterpartyName, 'Maria Construções');
});

// ═══ CONSULTAS (seção 30) ═════════════════════════════════════════
test('"quanto eu gastei esse mês?" -> query', () => {
  const r = parse('quanto eu gastei esse mês?');
  assert.equal(r.intent, 'query');
  assert.equal(r.query!.kind, 'month_expenses');
});

test('"quanto entrou hoje?" -> query income hoje', () => {
  const r = parse('quanto entrou hoje?');
  assert.equal(r.intent, 'query');
  assert.equal(r.query!.kind, 'month_income');
  assert.equal(r.query!.period, 'today');
});

test('"quanto tenho para receber?" -> query receivable', () => {
  const r = parse('quanto tenho para receber?');
  assert.equal(r.query!.kind, 'receivable');
});

test('"quanto devo para os fornecedores?" -> query payable', () => {
  const r = parse('quanto devo para os fornecedores?');
  assert.equal(r.query!.kind, 'payable');
});

test('"qual foi minha maior despesa?" -> biggest', () => {
  const r = parse('qual foi minha maior despesa?');
  assert.equal(r.query!.kind, 'biggest_expense');
});

test('"quanto gastei com combustível?" -> category_expenses', () => {
  const r = parse('quanto gastei com combustível?');
  assert.equal(r.query!.kind, 'category_expenses');
  assert.equal(r.query!.category, 'Combustível');
});

// ═══ EDIÇÃO/EXCLUSÃO (seção 31) ═══════════════════════════════════
test('"corrige aquele lançamento para 500" -> edit (não executa)', () => {
  const r = parse('corrige aquele lançamento para 500');
  assert.equal(r.intent, 'edit');
  assert.equal(r.edit!.field, 'amount');
  assert.equal(r.edit!.amount, 500);
});

test('"remove aquela despesa" -> delete (não executa)', () => {
  const r = parse('remove aquela despesa');
  assert.equal(r.intent, 'delete');
});

// ═══ RECORRÊNCIA (seção 37/19) ════════════════════════════════════
test('"todo mês pago 1500 de aluguel" -> recurrence, sem lançamentos', () => {
  const r = parse('todo mês pago 1500 de aluguel');
  assert.equal(r.intent, 'recurrence');
  assert.equal(r.entries.length, 0);
  assert.ok(r.recurrence);
});

// ═══ INFORMAL (seção 20) ══════════════════════════════════════════
test('"entrou 2k"', () => {
  const r = parse('entrou 2k');
  assert.equal(r.entries[0].amount, 2000);
});

test('"gastei uns 300 de gasolina"', () => {
  const r = parse('gastei uns 300 de gasolina');
  assert.equal(r.entries[0].amount, 300);
  assert.equal(r.entries[0].category, 'Combustível');
});

test('"paguei 500 pro fornecedor"', () => {
  const r = parse('paguei 500 pro fornecedor');
  assert.equal(r.entries[0].amount, 500);
  assert.equal(r.entries[0].direction, 'expense');
});

test('"o cliente me passou 800"', () => {
  const r = parse('o cliente me passou 800');
  assert.equal(r.entries[0].direction, 'income');
  assert.equal(r.entries[0].amount, 800);
});

// ═══ DIREÇÃO pura ═════════════════════════════════════════════════
test('detectDirectionAndTense: comprai vs vendi', () => {
  assert.equal(detectDirectionAndTense('comprei cimento por 500').direction, 'expense');
  assert.equal(detectDirectionAndTense('vendi cimento por 500').direction, 'income');
  assert.equal(detectDirectionAndTense('paguei o fornecedor 500').direction, 'expense');
  assert.equal(detectDirectionAndTense('o cliente ficou de me pagar 500').direction, 'income');
  assert.equal(detectDirectionAndTense('eu ainda tenho que pagar 500 ao fornecedor').direction, 'expense');
});
