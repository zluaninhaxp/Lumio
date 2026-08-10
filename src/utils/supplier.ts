export function parsePaymentDays(term: string): number | null {
  const match = term.match(/\d+/);
  if (!match) return null;
  const days = Number(match[0]);
  return Number.isFinite(days) ? days : null;
}

export function transactionDateToISO(date: string): string {
  const [day, month] = date.split('/').map(Number);
  const year = new Date().getFullYear();
  if (!day || !month) return new Date().toISOString().split('T')[0];
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDays(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export function suggestedDueDate(transactionDate: string, paymentTerm: string): string | undefined {
  const days = parsePaymentDays(paymentTerm);
  return days === null ? undefined : addDays(transactionDateToISO(transactionDate), days);
}

export function daysUntil(dateISO: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${dateISO}T00:00:00`);
  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
