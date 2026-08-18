/**
 * Resposta às CONSULTAS financeiras (seção 30) com dados REAIS do store —
 * substitui o mock hardcoded do `regexEngine.buildBotResponse`.
 *
 * Lê `transactions` com a mesma semântica da tela Financeiro
 * (`useFinanceState`): entrada = `amount>0 && confirmed!==false`; saída =
 * `amount<0` (pendências `supplierPaid:false`/`confirmed:false` NÃO entram
 * no saldo — são reportadas separadamente como a pagar/receber).
 */
import type { Transaction } from '../../store/index.ts';
import { formatBRL } from './apply.ts';
import type { FinancialQuery } from './types.ts';

function toISODate(tx: Transaction): string {
  const [d, m] = tx.date.split('/').map(Number);
  const y = new Date().getFullYear();
  return `${y}-${String(m ?? 1).padStart(2, '0')}-${String(d ?? 1).padStart(2, '0')}`;
}

function isRealizedIncome(tx: Transaction): boolean {
  return tx.amount > 0 && tx.confirmed !== false && !tx.expectedDate;
}

function isRealizedExpense(tx: Transaction): boolean {
  return tx.amount < 0 && tx.supplierPaid !== false;
}

/** Pendências: receita prevista não confirmada / despesa de fornecedor não paga. */
function pendingReceivable(tx: Transaction): boolean {
  return tx.amount > 0 && tx.confirmed === false;
}
function pendingPayable(tx: Transaction): boolean {
  return tx.amount < 0 && tx.supplierPaid === false;
}

/**
 * Responde a consulta com base nas transações reais. Devolve string pronta
 * para o bot. Não inventa números: tudo sai do array passado.
 */
export function answerFinancialQuery(query: FinancialQuery, transactions: Transaction[], today: Date): string {
  const todayISO = isoOf(today);

  if (query.kind === 'receivable') {
    const pending = transactions.filter(pendingReceivable);
    if (pending.length === 0) return 'Você não tem valores a receber registrados.';
    const total = pending.reduce((s, t) => s + t.amount, 0);
    const list = pending.slice(0, 5).map((t) => {
      const when = t.expectedDate ? new Date(`${t.expectedDate}T00:00:00`).toLocaleDateString('pt-BR') : 'sem data';
      return `${formatBRL(t.amount)} — ${t.description} (${when})`;
    });
    return [
      `Você tem ${formatBRL(total)} a receber:`,
      ...list.map((l) => `• ${l}`),
      ...(pending.length > 5 ? [`... e mais ${pending.length - 5}.`] : []),
    ].join('\n');
  }

  if (query.kind === 'payable') {
    const pending = transactions.filter(pendingPayable);
    if (pending.length === 0) return 'Você não tem contas a pagar registradas.';
    const total = pending.reduce((s, t) => s + Math.abs(t.amount), 0);
    const list = pending.slice(0, 5).map((t) => {
      const when = t.supplierDueDate ? new Date(`${t.supplierDueDate}T00:00:00`).toLocaleDateString('pt-BR') : 'sem data';
      return `${formatBRL(t.amount)} — ${t.description} (${when})`;
    });
    return [
      `Você tem ${formatBRL(total)} a pagar:`,
      ...list.map((l) => `• ${l}`),
      ...(pending.length > 5 ? [`... e mais ${pending.length - 5}.`] : []),
    ].join('\n');
  }

  // Filtros de período (realizadas)
  let pool = transactions.filter((t) => isRealizedIncome(t) || isRealizedExpense(t));
  if (query.period === 'today') pool = pool.filter((t) => toISODate(t) === todayISO);
  else if (query.period === 'month') pool = pool.filter((t) => toISODate(t).startsWith(`${todayISO.slice(0, 7)}`));

  const expenses = pool.filter((t) => t.amount < 0);
  const incomes = pool.filter((t) => t.amount > 0);
  const totalExpenses = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIncomes = incomes.reduce((s, t) => s + t.amount, 0);
  const periodLabel = query.period === 'today' ? 'hoje' : query.period === 'month' ? 'este mês' : 'no total';

  if (query.kind === 'biggest_expense') {
    if (expenses.length === 0) return 'Você não tem despesas registradas este mês.';
    const biggest = expenses.reduce((a, b) => (Math.abs(b.amount) > Math.abs(a.amount) ? b : a));
    return `Sua maior despesa ${periodLabel} foi ${formatBRL(biggest.amount)} em ${biggest.category} (${biggest.description}).`;
  }

  if (query.kind === 'category_expenses' && query.category) {
    const catExpenses = expenses.filter((t) => t.category === query.category);
    if (catExpenses.length === 0) return `Você não teve gastos com ${query.category} ${periodLabel}.`;
    return `Você gastou ${formatBRL(catExpenses.reduce((s, t) => s + Math.abs(t.amount), 0))} com ${query.category} ${periodLabel}, em ${catExpenses.length} lançamento(s).`;
  }

  if (query.kind === 'month_income') {
    if (totalIncomes === 0) return `Nenhuma entrada registrada ${periodLabel}.`;
    return `Entrou ${formatBRL(totalIncomes)} ${periodLabel}, em ${incomes.length} lançamento(s).`;
  }

  if (query.kind === 'month_expenses') {
    if (totalExpenses === 0) return `Você não teve gastos ${periodLabel}.`;
    const byCat = new Map<string, number>();
    expenses.forEach((t) => byCat.set(t.category, (byCat.get(t.category) ?? 0) + Math.abs(t.amount)));
    const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    return [
      `Você gastou ${formatBRL(totalExpenses)} ${periodLabel}:`,
      ...top.map(([cat, v]) => `• ${cat}: ${formatBRL(v)}`),
    ].join('\n');
  }

  // balance / generic
  const saldo = totalIncomes - totalExpenses;
  return [
    `Resumo ${periodLabel}:`,
    `• Entradas: ${formatBRL(totalIncomes)}`,
    `• Saídas: ${formatBRL(totalExpenses)}`,
    `• Saldo: ${formatBRL(saldo)}`,
  ].join('\n');
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
