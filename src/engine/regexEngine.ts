// Motor de Regex mínimo para testes — será expandido via onboarding generativo

export type Intent =
  | 'EXPENSE_RECORD'
  | 'INCOME_RECORD'
  | 'TASK_ADD'
  | 'TASK_WITH_DATE'
  | 'QUERY_REPORT'
  | 'CLIENT_PAYMENT_QUERY'
  | 'CLIENT_PENDING_QUERY'
  | 'SUPPLIER_BALANCE_QUERY'
  | 'SUPPLIER_DUE_QUERY'
  | 'STOCK_BALANCE_QUERY'
  | 'STOCK_DECREASE'
  | 'STOCK_LOW_QUERY'
  | 'UNKNOWN';

export interface ParsedMessage {
  intent: Intent;
  entities: {
    value?: number;
    category?: string;
    description?: string;
    date?: string;
    clientName?: string;
    supplierName?: string;
    paymentDays?: number;
    stockItemName?: string;
  };
  raw: string;
}

const EXPENSE_PATTERN =
  /(?:gastei|paguei|comprei|custo[u]?|despesa de?)\s+(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:reais?\s*)?(?:de\s+)?(.+)?/i;

const INCOME_PATTERN =
  /(?:recebi|entrou|vendi|fiz|ganhei|pagamento de?|recebimento de?)\s+(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:(?:de|do|da)\s+)?(.+)?/i;

const TASK_DATE_PATTERN =
  /(?:preciso|tenho que|devo|lembra(?:r)?(?:\s+de)?)\s+(.+?)\s+(?:até|para|no dia|na|em)\s+(segunda|terça|quarta|quinta|sexta|sábado|domingo|\d{1,2}\/\d{1,2})/i;

const TASK_PATTERN =
  /(?:preciso|tenho que|devo|lembra(?:r)?(?:\s+de)?|adiciona(?:r)?|cria(?:r)?)\s+(.+)/i;

const QUERY_PATTERN =
  /(?:quanto\s+(?:gastei|recebi|tenho)|resumo|relatório|total|balanço)/i;

const CLIENT_PAYMENT_QUERY_PATTERN = /quanto\s+(?:o|a)?\s*(.+?)\s+(?:já\s+)?pagou(?:\s+esse\s+per[ií]odo)?/i;
const CLIENT_PENDING_QUERY_PATTERN = /(?:o|a)?\s*(.+?)\s+tem\s+pend[eê]ncia/i;
const SUPPLIER_BALANCE_QUERY_PATTERN = /quanto\s+devo\s+(?:pro|para\s+o|para\s+a)\s+fornecedor\s+(.+?)(?:\?|$)/i;
const SUPPLIER_DUE_QUERY_PATTERN = /quando\s+vence\s+a\s+última\s+compra\s+(?:da|do)\s+(.+?)(?:\?|$)/i;
const STOCK_BALANCE_QUERY_PATTERN = /quantos\s+(.+?)\s+(?:eu\s+)?tenho(?:\?|$)/i;
const STOCK_DECREASE_PATTERN = /dei\s+baixa\s+de\s+(\d+(?:[.,]\d+)?)\s+(.+?)(?:\?|$)/i;
const STOCK_LOW_QUERY_PATTERN = /o\s+que\s+est[aá]\s+acabando/i;

function parseValue(raw: string): number {
  return parseFloat(raw.replace(',', '.'));
}

export function parseMessage(input: string): ParsedMessage {
  const text = input.trim();

  const supplierBalanceMatch = text.match(SUPPLIER_BALANCE_QUERY_PATTERN);
  if (supplierBalanceMatch) return { intent: 'SUPPLIER_BALANCE_QUERY', entities: { supplierName: supplierBalanceMatch[1].trim() }, raw: text };
  const supplierDueMatch = text.match(SUPPLIER_DUE_QUERY_PATTERN);
  if (supplierDueMatch) return { intent: 'SUPPLIER_DUE_QUERY', entities: { supplierName: supplierDueMatch[1].trim() }, raw: text };
  const stockDecreaseMatch = text.match(STOCK_DECREASE_PATTERN);
  if (stockDecreaseMatch) return { intent: 'STOCK_DECREASE', entities: { value: parseValue(stockDecreaseMatch[1]), stockItemName: stockDecreaseMatch[2].trim() }, raw: text };
  if (STOCK_LOW_QUERY_PATTERN.test(text)) return { intent: 'STOCK_LOW_QUERY', entities: {}, raw: text };
  const stockBalanceMatch = text.match(STOCK_BALANCE_QUERY_PATTERN);
  if (stockBalanceMatch) return { intent: 'STOCK_BALANCE_QUERY', entities: { stockItemName: stockBalanceMatch[1].trim() }, raw: text };

  const clientPaymentMatch = text.match(CLIENT_PAYMENT_QUERY_PATTERN);
  if (clientPaymentMatch) {
    return { intent: 'CLIENT_PAYMENT_QUERY', entities: { clientName: clientPaymentMatch[1].trim() }, raw: text };
  }

  const clientPendingMatch = text.match(CLIENT_PENDING_QUERY_PATTERN);
  if (clientPendingMatch) {
    return { intent: 'CLIENT_PENDING_QUERY', entities: { clientName: clientPendingMatch[1].trim() }, raw: text };
  }

  // Despesa
  const expenseMatch = text.match(EXPENSE_PATTERN);
  if (expenseMatch) {
    return {
      intent: 'EXPENSE_RECORD',
      entities: {
        value: parseValue(expenseMatch[1]),
        description: expenseMatch[2]?.trim() || 'Despesa',
        category: guessCategory(expenseMatch[2] || ''),
        supplierName: expenseMatch[2]?.match(/(?:do|da|de)\s+fornecedor\s+(.+?)(?:,\s*pago\s+em\s+\d+\s+dias?)?$/i)?.[1]?.trim(),
        paymentDays: expenseMatch[2]?.match(/pago\s+em\s+(\d+)\s+dias?/i)?.[1] ? Number(expenseMatch[2].match(/pago\s+em\s+(\d+)\s+dias?/i)![1]) : undefined,
      },
      raw: text,
    };
  }

  // Receita
  const incomeMatch = text.match(INCOME_PATTERN);
  if (incomeMatch) {
    return {
      intent: 'INCOME_RECORD',
      entities: {
        value: parseValue(incomeMatch[1]),
        description: incomeMatch[2]?.trim() || 'Receita',
        category: 'Receita',
      },
      raw: text,
    };
  }

  // Tarefa com data
  const taskDateMatch = text.match(TASK_DATE_PATTERN);
  if (taskDateMatch) {
    return {
      intent: 'TASK_WITH_DATE',
      entities: {
        description: taskDateMatch[1]?.trim(),
        date: taskDateMatch[2]?.trim(),
      },
      raw: text,
    };
  }

  // Tarefa simples
  const taskMatch = text.match(TASK_PATTERN);
  if (taskMatch) {
    return {
      intent: 'TASK_ADD',
      entities: {
        description: taskMatch[1]?.trim(),
      },
      raw: text,
    };
  }

  // Consulta
  if (QUERY_PATTERN.test(text)) {
    return { intent: 'QUERY_REPORT', entities: {}, raw: text };
  }

  return { intent: 'UNKNOWN', entities: {}, raw: text };
}

function guessCategory(text: string): string {
  const t = text.toLowerCase();
  if (/gasolin|combustív|diesel|etanol|álcool/.test(t)) return 'Combustível';
  if (/almoç|janta|comid|alimenta|mercad|lanche/.test(t)) return 'Alimentação';
  if (/fornecedor|forn\./.test(t)) return 'Fornecedores';
  return 'Materiais';
}

export function buildBotResponse(parsed: ParsedMessage): string {
  const { intent, entities } = parsed;
  const fmt = (v: number) =>
    `R$ ${Math.abs(v).toFixed(2).replace('.', ',')}`;

  switch (intent) {
    case 'EXPENSE_RECORD':
      return `✓ Despesa de ${fmt(entities.value!)} em ${entities.category} registrada para hoje.`;
    case 'INCOME_RECORD':
      return `✓ Entrada de ${fmt(entities.value!)}${entities.description ? ` — ${entities.description}` : ''} registrada para hoje.`;
    case 'TASK_ADD':
      return `✓ Tarefa registrada: ${entities.description}.`;
    case 'TASK_WITH_DATE':
      return `✓ Adicionado ao calendário: ${entities.description} — ${entities.date}.`;
    case 'QUERY_REPORT':
      return `Você gastou R$ 1.640,00 este mês, distribuídos em:\n• Combustível: R$ 620,00\n• Materiais: R$ 480,00\n• Fornecedores: R$ 350,00\n• Alimentação: R$ 190,00\n\nEntradas: R$ 3.200,00 — Saldo: R$ 1.560,00`;
    case 'CLIENT_PAYMENT_QUERY':
      return '';
    case 'CLIENT_PENDING_QUERY':
      return '';
    case 'SUPPLIER_BALANCE_QUERY':
    case 'SUPPLIER_DUE_QUERY':
      return '';
    case 'STOCK_BALANCE_QUERY':
    case 'STOCK_DECREASE':
    case 'STOCK_LOW_QUERY':
      return '';
    default:
      return '';
  }
}
