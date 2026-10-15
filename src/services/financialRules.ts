import type { Transaction } from '../store/index.ts';

export function localISO(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validISO(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
/** No year is inferred from creation time, due date or the device clock. */
export function financialDate(tx: Pick<Transaction, 'date'>): string | null {
  return validISO(tx.date) ? tx.date : null;
}
export function dateInput(value: string): string {
  if (!validISO(value)) return value;
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
export function parseDateInput(value: string): string | null {
  if (validISO(value)) return value;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : '';
  return validISO(iso) ? iso : null;
}
export function realizedIncome(tx: Transaction): boolean { return tx.amount > 0 && tx.confirmed !== false; }
export function realizedExpense(tx: Transaction): boolean { return tx.amount < 0 && tx.supplierPaid !== false && tx.confirmed !== false; }
export function isRealized(tx: Transaction): boolean { return realizedIncome(tx) || realizedExpense(tx); }
export function transactionOrigin(tx: Transaction): string | null {
  if (tx.originArchived) return 'histórico preservado (origem arquivada)';
  if (tx.orderId) return 'Vendas';
  if (tx.contractId) return 'Contratos';
  if (tx.taskId) return 'Tarefas';
  if (tx.stockReceived) return 'Estoque (compra já recebida)';
  return null;
}
export function assertEditableTransaction(tx: Transaction | undefined) {
  if (!tx) throw new Error('Lançamento não encontrado. Atualize e tente novamente.');
  const origin = transactionOrigin(tx);
  if (origin) throw new Error(`Este lançamento pertence a ${origin}. Altere sua origem para preservar os vínculos e o histórico.`);
}
/** Keep the original billing day, clamped to the last day of each target month. */
export function advanceBillingDate(iso: string, months: number, anchor: string): string {
  if (!validISO(iso) || !validISO(anchor)) throw new Error('Revise a data inicial do contrato.');
  const [year, month] = iso.split('-').map(Number);
  const target = new Date(year, month - 1 + months, 1, 12);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
  target.setDate(Math.min(Number(anchor.slice(-2)), last));
  return localISO(target);
}
