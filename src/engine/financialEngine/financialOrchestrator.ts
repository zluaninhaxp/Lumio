/**
 * Orquestração Financeiro ↔ Tarefa ↔ Calendário no nível do store.
 *
 * Funções puras que recebem o `useAppStore` (interface mínima) e aplicam
 * o resultado do `financialParser`:
 *
 *  - `create_obligation` (seções 25/26/46): despesa/receita pendente +
 *    tarefa ("Pagar ...") + calendário derivado (`calendarizeTask`),
 *    tudo vinculado (`linkTaskToTransaction`). Uma mensagem = três
 *    entidades RELACIONADAS, nunca independentes.
 *  - `create_transaction`: apenas transação(ões) realizada(s).
 *  - `query`: respondido em `queryAnswer.ts` (dados reais).
 *
 * Mantido aqui (fora do component) para ser testável em node --test com
 * um store falso que espelha a interface do zustand.
 */
import { entryToTransactionPayload } from './apply.ts';
import type { ParsedFinancialEntry, FinancialParseResult } from './types.ts';
import type { Transaction, Task } from '../../store/index.ts';

/** Interface mínima do store consumida pela orquestração. */
export interface FinancialStoreApi {
  addTransaction: (t: Omit<Transaction, 'id'>) => string;
  addTask: (t: Omit<Task, 'id'>) => string;
  calendarizeTask: (taskId: string, opts: { date: string; time?: string | null; deadline?: boolean; eventType?: string }) => boolean;
  linkTaskToTransaction: (taskId: string, transactionId: string) => void;
}

/** Shape do card financeiro consumido pelo `BotMessageCard`. */
export interface FinanceBotCard {
  kind: 'finance';
  title: string;
  amount?: number;
  direction?: 'expense' | 'income';
  pending?: boolean;
  category?: string;
  date?: string;
  dateLabel?: string;
  counterparty?: string;
}

export interface FinancialApplicationResult {
  transactionIds: string[];
  /** Tarefa criada (obrigação futura), quando houver. */
  taskId: string | null;
  created: 'transactions' | 'obligation' | 'nothing';
}

function obligationTaskTitle(entry: ParsedFinancialEntry): string {
  const verb = entry.direction === 'expense' ? 'Pagar' : 'Receber de';
  const who = entry.counterpartyName ?? '';
  const what = entry.item && entry.item.toLowerCase() !== who.toLowerCase() ? ` ${entry.item}` : '';
  return `${verb}${who ? ` ${who}` : ''}${what}`.replace(/\s+/g, ' ').trim();
}

/**
 * Aplica um resultado do parser no store. Para obrigações futuras cria
 * Task + calendário derivado + transação pendente, tudo vinculado.
 */
export function applyFinancialResult(
  result: FinancialParseResult,
  store: FinancialStoreApi
): FinancialApplicationResult {
  if (result.intent === 'create_transaction') {
    const ids = result.entries.map((e) => store.addTransaction(entryToTransactionPayload(e)));
    return { transactionIds: ids, taskId: null, created: 'transactions' };
  }

  if (result.intent === 'create_obligation' && result.entries.length > 0) {
    // Uma obrigação por mensagem (múltiplas pendências futuras na mesma
    // frase são raras; a primeira representa a obrigação principal).
    const entry = result.entries[0];
    const taskId = store.addTask({
      description: obligationTaskTitle(entry) || 'Acertar compromisso financeiro',
      done: false,
      dueDate: entry.dueDate,
      dueDateLabel: null,
      priority: 'alta',
      subtasks: [],
      tags: ['Financeiro'],
      createdAt: new Date().toISOString(),
    });
    const transactionIds = result.entries.map((e) => store.addTransaction(entryToTransactionPayload(e)));
    if (entry.dueDate) {
      store.calendarizeTask(taskId, { date: entry.dueDate, deadline: true });
    }
    store.linkTaskToTransaction(taskId, transactionIds[0]);
    return { transactionIds, taskId, created: 'obligation' };
  }

  return { transactionIds: [], taskId: null, created: 'nothing' };
}

/** Monta os cards do bot a partir das entries criadas. */
export function buildFinanceCards(entries: ParsedFinancialEntry[]): FinanceBotCard[] {
  return entries.map((e) => ({
    kind: 'finance' as const,
    title: e.item ?? (e.direction === 'expense' ? 'Saída registrada' : 'Entrada registrada'),
    amount: e.amount ?? undefined,
    direction: e.direction,
    pending: e.tense === 'future',
    category: e.category ?? 'Sem categoria',
    date: e.tense === 'future' ? e.dueDate ?? undefined : e.transactionDate ?? undefined,
    dateLabel: e.tense === 'future'
      ? e.dueDate ? `Vence ${new Date(`${e.dueDate}T00:00:00`).toLocaleDateString('pt-BR')}` : undefined
      : e.transactionDate ? new Date(`${e.transactionDate}T00:00:00`).toLocaleDateString('pt-BR') : undefined,
    counterparty: e.counterpartyName ?? undefined,
  }));
}
