/**
 * Persistência dos resultados do parser financeiro no domínio do store.
 *
 * Mapeia `ParsedFinancialEntry` -> `Transaction` PRESERVANDO os padrões
 * existentes da tela Financeiro:
 *
 *  - Realizada (paid/received): `amount` com sinal (entrada >0, saída <0),
 *    `date` = "DD/MM" do `transactionDate`, sem flags de pendência.
 *  - Pendência futura (pending): NÃO entra no saldo do mês — usa o mesmo
 *    padrão dos contratos (`expectedDate` + `confirmed:false`) para receita
 *    e a variável de fornecedores (`supplierDueDate` + `supplierPaid:false`)
 *    para despesa, com `date` = "DD/MM" do `dueDate`.
 *  - `expectedDate`/`supplierDueDate` permanecem ISO YYYY-MM-DD.
 *
 * Regras de não-invenção (seção 42): categoria ausente = 'Sem categoria'
 * (o `Transaction.category` é string obrigatória; o rótulo neutro é o
 * comportamento do domínio). Contraparte só é vinculada por id quando
 * resolvida contra o contexto real.
 */
import type { ParsedFinancialEntry } from './types.ts';

export interface AppliedTransaction {
  transaction: import('../../store/index.ts').Transaction;
  /** Id devolvido pelo `addTransaction` (preenchido pelo consumidor). */
  id: string;
}

/** Formata ISO YYYY-MM-DD -> "DD/MM" (formato da tela Financeiro). */
function isoToDDMM(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** Rótulo de descrição sem inventar conteúdo: usa item/contraparte/verbos. */
function buildDescription(entry: ParsedFinancialEntry): string {
  const parts: string[] = [];
  if (entry.item) parts.push(entry.item);
  if (entry.counterpartyName && parts.join(' ').toLowerCase() !== entry.counterpartyName.toLowerCase()) {
    parts.push(`— ${entry.counterpartyName}`);
  }
  if (entry.installments && entry.installments > 1) parts.push(`(${entry.installments}x)`);
  if (parts.length === 0) return entry.direction === 'expense' ? 'Despesa' : 'Receita';
  const desc = parts.join(' ').replace(/\s+/g, ' ').trim();
  return desc.length > 60 ? desc.slice(0, 57) + '...' : desc;
}

/**
 * Converte uma entry parseada no payload de `addTransaction` (sem `id`).
 */
export function entryToTransactionPayload(entry: ParsedFinancialEntry): Omit<import('../../store/index.ts').Transaction, 'id'> {
  const signedAmount = entry.direction === 'expense' ? -Math.abs(entry.amount!) : Math.abs(entry.amount!);
  const isFuture = entry.tense === 'future';
  const dateISO = isFuture ? entry.dueDate! : entry.transactionDate!;
  const date = isoToDDMM(dateISO);

  if (isFuture) {
    // Pendência: mesmo padrão dos contratos (receita) / fornecedores (despesa).
    return {
      date,
      description: buildDescription(entry),
      amount: signedAmount,
      category: entry.category ?? 'Sem categoria',
      ...(entry.direction === 'income'
        ? { expectedDate: entry.dueDate!, confirmed: false }
        : { supplierDueDate: entry.dueDate!, supplierPaid: false }),
      ...(entry.counterpartyClientId ? { clientId: entry.counterpartyClientId } : {}),
      ...(entry.counterpartySupplierId ? { supplierId: entry.counterpartySupplierId } : {}),
      ...(entry.counterpartyEmployeeId ? { employeeId: entry.counterpartyEmployeeId } : {}),
    };
  }

  return {
    date,
    description: buildDescription(entry),
    amount: signedAmount,
    category: entry.category ?? 'Sem categoria',
    ...(entry.counterpartyClientId ? { clientId: entry.counterpartyClientId } : {}),
    ...(entry.counterpartySupplierId ? { supplierId: entry.counterpartySupplierId, supplierPaid: true } : {}),
    ...(entry.counterpartyEmployeeId ? { employeeId: entry.counterpartyEmployeeId } : {}),
  };
}

export function formatBRL(value: number): string {
  return `R$ ${Math.abs(value).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/**
 * Resposta do bot para criação de movimentação(s) — uma frase por entry,
 * sempre refletindo exatamente o que foi persistido (nada a mais).
 */
export function buildFinancialBotText(entries: ParsedFinancialEntry[]): string {
  const lines = entries.map((entry) => {
    const value = formatBRL(entry.amount!);
    const dir = entry.direction === 'expense' ? 'Saída' : 'Entrada';
    const who = entry.counterpartyName ? ` · ${entry.counterpartyName}` : '';
    const cat = entry.category ? ` · ${entry.category}` : ' · Sem categoria';
    if (entry.tense === 'future') {
      const when = entry.dueDate ? new Date(`${entry.dueDate}T00:00:00`).toLocaleDateString('pt-BR') : 'data indefinida';
      const verb = entry.direction === 'expense' ? 'a pagar' : 'a receber';
      return `✓ ${dir} ${verb} de ${value} registrada para ${when}${cat}${who}`;
    }
    return `✓ ${dir} de ${value} registrada${cat}${who}`;
  });
  return lines.join('\n');
}
