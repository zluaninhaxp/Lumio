/**
 * Tipos do motor determinístico de FINANCEIRO.
 *
 * Mesma arquitetura híbrida do taskEngine/calendarEngine: interpretação em
 * camadas (normalização -> intenção -> valor -> temporal -> contraparte ->
 * categoria -> validação), reaproveitando `taskEngine/normalize.ts`,
 * `taskEngine/temporal.ts` e `taskEngine/personResolver.ts`.
 *
 * Regra de ouro (especificação seção 42): NUNCA inventar valor, categoria,
 * pessoa, data, status, pagamento ou recebimento. Informação ausente fica
 * `null`/`undefined` — nunca preenchida por heurística.
 *
 * Os tipos aqui são INTERMEDIÁRIOS entre a mensagem e o store: o schema
 * persistido (`Transaction` em `src/store/index.ts`) é preservado. O status
 * do domínio é derivado: receita pendente = `confirmed:false` +
 * `expectedDate` (padrão dos contratos); despesa pendente = `supplierPaid:
 * false` + `supplierDueDate` (padrão do fluxo de fornecedores).
 */
import type { ConfidenceLevel } from '../taskEngine/types.ts';

export type FinancialDirection = 'expense' | 'income';

/** Realizado (passado/presente) vs obrigação/expectativa futura. */
export type FinancialTense = 'realized' | 'future';

/**
 * Intenções reconhecidas:
 *  - `create_transaction`: 1..N movimentações REALIZADAS com valor.
 *  - `create_obligation`: 1..N pendências futuras (a pagar/receber) com
 *    valor; sugere tarefa + representação de calendário.
 *  - `incomplete`: intenção financeira clara, mas valor ausente (não cria
 *    nada — o chat pergunta o valor; nunca inventa).
 *  - `query`: consulta sobre dados reais (respondida com dados do store).
 *  - `edit` / `delete`: alteração/exclusão de lançamento existente —
 *    RECONHECIDAS mas NÃO executadas (não há resolução de referência
 *    "aquele lançamento" na arquitetura atual; o chat orienta usar a tela
 *    Financeiro). Preparado para evolução futura.
 *  - `recurrence`: recorrente ("todo mês pago...") — reconhecida, não gera
 *    lançamentos automáticos (sem recorrência no domínio ainda).
 *  - `none`: não é financeiro (deixa taskEngine/calendarEngine decidirem).
 */
export type FinancialIntent =
  | 'create_transaction'
  | 'create_obligation'
  | 'incomplete'
  | 'query'
  | 'edit'
  | 'delete'
  | 'recurrence'
  | 'none';

/** Contexto real do usuário injetado no parser (não inventa nada). */
export interface FinancialParserContext {
  now: Date;
  /** Labels de `financialExpenseCategories` do onboarding. */
  expenseCategories: string[];
  /** Labels de `financialIncomeCategories` do onboarding. */
  incomeCategories: string[];
  /** keywordMap do onboarding (palavra -> categoria/tag). */
  keywordMap: Record<string, string>;
  /** Clientes reais (`clienteItems`). */
  clients: ReadonlyArray<{ id: string; name: string }>;
  /** Fornecedores reais (`fornecedorItems`). */
  suppliers: ReadonlyArray<{ id: string; name: string; paymentTerm: string }>;
  /** Funcionários reais (`employeeItems`). */
  employees: ReadonlyArray<{ id: string; name: string }>;
}

/** Uma movimentação reconhecida, antes da persistência. */
export interface ParsedFinancialEntry {
  direction: FinancialDirection;
  tense: FinancialTense;
  /** Valor em BRL. `null` = não informado (ver `incomplete`). */
  amount: number | null;
  /** Verdadeiro quando o valor veio de aritmética segura ("5 por 100 cada"). */
  amountComputed: boolean;
  /** Nome/empresa da contraparte, ou null se não houver. */
  counterpartyName: string | null;
  counterpartyClientId: string | null;
  counterpartySupplierId: string | null;
  counterpartyEmployeeId: string | null;
  /** Categoria resolvida contra o onboarding, ou null = sem categoria. */
  category: string | null;
  /** Texto do item (ex.: "Gasolina") para a descrição, ou null. */
  item: string | null;
  /** Data EFETIVA da movimentação (ISO YYYY-MM-DD) — só para realizada. */
  transactionDate: string | null;
  /** Vencimento/expectativa (ISO YYYY-MM-DD) — só para pendência. */
  dueDate: string | null;
  /** paid/received = efetivado; pending = obrigação/expectativa. */
  status: 'paid' | 'received' | 'pending';
  /** Parcelamento preservado ("em 3x") — não multiplica lançamentos. */
  installments: number | null;
  /** Quantidade mencionada ("10 sacos por 500") — preservada como contexto. */
  quantity: number | null;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  /** Fragmento original que originou esta entrada. */
  originalText: string;
}

/** Consulta reconhecida (respondida com dados REAIS do store). */
export interface FinancialQuery {
  kind:
    | 'month_expenses'
    | 'month_income'
    | 'balance'
    | 'receivable'
    | 'payable'
    | 'biggest_expense'
    | 'category_expenses'
    | 'generic';
  /** Categoria mencionada na consulta ("com combustível"), se casar. */
  category: string | null;
  period: 'month' | 'today' | 'total';
}

/** Referência de alteração reconhecida (não executada). */
export interface FinancialEditRef {
  kind: 'edit' | 'delete';
  /** Campo alvo mencionado (valor, categoria, data...), quando identificável. */
  field: 'amount' | 'category' | 'date' | 'counterparty' | 'unknown';
  amount: number | null;
}

export interface FinancialParseResult {
  intent: FinancialIntent;
  confidence: number;
  entries: ParsedFinancialEntry[];
  query: FinancialQuery | null;
  edit: FinancialEditRef | null;
  recurrence: { expression: string } | null;
  /** Motivo humano quando intent não gera lançamentos. */
  reason: string | null;
  originalText: string;
}
