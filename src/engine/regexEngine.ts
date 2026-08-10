// Motor de Regex mínimo para testes — será expandido via onboarding generativo

export type Intent =
  | 'EXPENSE_RECORD'
  | 'INCOME_RECORD'
  | 'TASK_ADD'
  | 'TASK_WITH_DATE'
  | 'QUERY_REPORT'
  | 'CLIENT_PAYMENT_QUERY'
  | 'CLIENT_PENDING_QUERY'
  | 'UNKNOWN';

export interface ParsedMessage {
  intent: Intent;
  entities: {
    value?: number;
    category?: string;
    description?: string;
    date?: string;
    clientName?: string;
  };
  raw: string;
}

const EXPENSE_PATTERN =
  /(?:gastei|paguei|comprei|custo[u]?|despesa de?)\s+(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:de\s+)?(.+)?/i;

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

function parseValue(raw: string): number {
  return parseFloat(raw.replace(',', '.'));
}

export function parseMessage(input: string): ParsedMessage {
  const text = input.trim();

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
    default:
      return '';
  }
}
