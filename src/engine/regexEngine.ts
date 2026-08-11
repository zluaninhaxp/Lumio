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
  | 'ORDER_CREATE'
  | 'ORDER_OPEN_QUERY'
  | 'SALES_WEEK_QUERY'
  | 'QUOTE_CREATE'
  | 'QUOTE_STATUS_QUERY'
| 'QUOTE_EXPIRING_QUERY'
  | 'EMPLOYEE_TASKS_QUERY'
  | 'TASK_ASSIGN'
  | 'COMMISSION_MONTH_QUERY'
  | 'COMMISSION_PAY'
  | 'DELIVERY_STATUS_QUERY'
  | 'DELIVERY_PENDING_QUERY'
  | 'CONTRACT_DUE_QUERY'
  | 'CONTRACT_STATUS_QUERY'
  | 'FREE_SLOT_QUERY'
  | 'APPOINTMENT_CREATE'
  | 'APPOINTMENT_TODAY_QUERY'
  | 'UNKNOWN';

export interface ParsedMessage {
  intent: Intent;
  entities: {
    value?: number;
    category?: string;
    description?: string;
    date?: string;
    time?: string;
    clientName?: string;
    supplierName?: string;
    paymentDays?: number;
    stockItemName?: string;
    orderItemName?: string;
    orderQuantity?: number;
    unitPrice?: number;
    quoteItemsText?: string;
    employeeName?: string;
    orderId?: string;
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
const ORDER_CREATE_PATTERN = /(?:registra|registre|cria|criar)\s+(?:uma\s+)?venda\s+de\s+(\d+(?:[.,]\d+)?)\s+(.+?)\s+(?:pro|para\s+o|para\s+a)\s+(.+?)\s+a\s+(?:r\$\s*)?(\d+(?:[.,]\d+)?)\s+reais?\s+cada/i;
const ORDER_OPEN_QUERY_PATTERN = /quais\s+pedidos\s+est[aã]o\s+em\s+aberto/i;
const SALES_WEEK_QUERY_PATTERN = /quanto\s+vendi\s+essa\s+semana/i;
const QUOTE_CREATE_PATTERN = /(?:cria|criar|registra|registre)\s+(?:um|uma)?\s*orçamento\s+(?:pro|para\s+o|para\s+a)\s+cliente\s+(.+?)\s+com\s+(.+)/i;
const QUOTE_STATUS_QUERY_PATTERN = /o\s+orçamento\s+(?:do|da)\s+(.+?)\s+foi\s+aprovado/i;
const QUOTE_EXPIRING_QUERY_PATTERN = /quais\s+orçamentos\s+vencem\s+essa\s+semana/i;
const EMPLOYEE_TASKS_QUERY_PATTERN = /quais\s+tarefas\s+(?:o|a)?\s*(.+?)\s+tem\s+hoje\??$/i;
const TASK_ASSIGN_PATTERN = /atribui(?:r)?\s+(?:essa|esta|a)?\s*tarefa\s+(?:pro|para\s+o|para\s+a)\s+(.+?)\s*\??$/i;
const COMMISSION_MONTH_QUERY_PATTERN = /quanto\s+(?:o|a)?\s*(.+?)\s+tem\s+de\s+comissão\s+esse\s+mês\??$/i;
const COMMISSION_PAY_PATTERN = /fecha\s+a\s+comissão\s+(?:do|da)\s+(.+?)\s*\??$/i;
const DELIVERY_STATUS_QUERY_PATTERN = /a\s+entrega\s+do\s+pedido\s+#?([\w-]+)\s+(?:já\s+)?saiu\??$/i;
const DELIVERY_PENDING_QUERY_PATTERN = /quais\s+entregas\s+est[aã]o\s+pendentes\s+hoje\??$/i;
const CONTRACT_DUE_QUERY_PATTERN = /quais\s+contratos\s+vencem\s+esse\s+m[eê]s\??$/i;
const CONTRACT_STATUS_QUERY_PATTERN = /o\s+contrato\s+do\s+(.+?)\s+est[aá]\s+em\s+dia\??$/i;
const FREE_SLOT_QUERY_PATTERN = /tenho\s+hor[aá]rio\s+livre\s+(hoje|amanh[ãa]|segunda|ter[cç]a|quarta|quinta|sexta|s[áa]bado|domingo)\s+[`aà]s?\s+(\d{1,2})(?::(\d{2}))?\s*h?\??$/i;
const APPOINTMENT_CREATE_PATTERN = /marca\s+(?:o|a)?\s*(.+?)\s+para\s+(hoje|amanh[ãa]|segunda|ter[cç]a|quarta|quinta|sexta|s[áa]bado|domingo)\s+[`aà]s?\s+(\d{1,2})(?::(\d{2}))?\s*h?\??$/i;
const APPOINTMENT_TODAY_QUERY_PATTERN = /quais\s+atendimentos\s+tenho\s+hoje\??$/i;

function parseValue(raw: string): number {
  return parseFloat(raw.replace(',', '.'));
}

export function parseMessage(input: string): ParsedMessage {
  const text = input.trim();

  const employeeTasksMatch = text.match(EMPLOYEE_TASKS_QUERY_PATTERN);
  if (employeeTasksMatch) return { intent: 'EMPLOYEE_TASKS_QUERY', entities: { employeeName: employeeTasksMatch[1].trim() }, raw: text };
const taskAssignMatch = text.match(TASK_ASSIGN_PATTERN);
  if (taskAssignMatch) return { intent: 'TASK_ASSIGN', entities: { employeeName: taskAssignMatch[1].trim() }, raw: text };
  const commissionMonthMatch = text.match(COMMISSION_MONTH_QUERY_PATTERN);
  if (commissionMonthMatch) return { intent: 'COMMISSION_MONTH_QUERY', entities: { employeeName: commissionMonthMatch[1].trim() }, raw: text };
  const commissionPayMatch = text.match(COMMISSION_PAY_PATTERN);
  if (commissionPayMatch) return { intent: 'COMMISSION_PAY', entities: { employeeName: commissionPayMatch[1].trim() }, raw: text };
  const deliveryStatusMatch = text.match(DELIVERY_STATUS_QUERY_PATTERN);
  if (deliveryStatusMatch) return { intent: 'DELIVERY_STATUS_QUERY', entities: { orderId: deliveryStatusMatch[1] }, raw: text };
  if (DELIVERY_PENDING_QUERY_PATTERN.test(text)) return { intent: 'DELIVERY_PENDING_QUERY', entities: {}, raw: text };
  if (CONTRACT_DUE_QUERY_PATTERN.test(text)) return { intent: 'CONTRACT_DUE_QUERY', entities: {}, raw: text };
  const contractStatusMatch = text.match(CONTRACT_STATUS_QUERY_PATTERN);
  if (contractStatusMatch) return { intent: 'CONTRACT_STATUS_QUERY', entities: { clientName: contractStatusMatch[1].trim() }, raw: text };
  const freeSlotMatch = text.match(FREE_SLOT_QUERY_PATTERN);
  if (freeSlotMatch) return { intent: 'FREE_SLOT_QUERY', entities: { date: freeSlotMatch[1].trim(), time: `${freeSlotMatch[2].padStart(2, '0')}:${freeSlotMatch[3] ?? '00'}` }, raw: text };
  const appointmentCreateMatch = text.match(APPOINTMENT_CREATE_PATTERN);
  if (appointmentCreateMatch) return { intent: 'APPOINTMENT_CREATE', entities: { clientName: appointmentCreateMatch[1].trim(), date: appointmentCreateMatch[2].trim(), time: `${appointmentCreateMatch[3].padStart(2, '0')}:${appointmentCreateMatch[4] ?? '00'}` }, raw: text };
  if (APPOINTMENT_TODAY_QUERY_PATTERN.test(text)) return { intent: 'APPOINTMENT_TODAY_QUERY', entities: {}, raw: text };

  const quoteCreateMatch = text.match(QUOTE_CREATE_PATTERN);
  if (quoteCreateMatch) return { intent: 'QUOTE_CREATE', entities: { clientName: quoteCreateMatch[1].trim(), quoteItemsText: quoteCreateMatch[2].trim() }, raw: text };
  const quoteStatusMatch = text.match(QUOTE_STATUS_QUERY_PATTERN);
  if (quoteStatusMatch) return { intent: 'QUOTE_STATUS_QUERY', entities: { clientName: quoteStatusMatch[1].trim() }, raw: text };
  if (QUOTE_EXPIRING_QUERY_PATTERN.test(text)) return { intent: 'QUOTE_EXPIRING_QUERY', entities: {}, raw: text };

  const orderCreateMatch = text.match(ORDER_CREATE_PATTERN);
  if (orderCreateMatch) return { intent: 'ORDER_CREATE', entities: { orderQuantity: parseValue(orderCreateMatch[1]), orderItemName: orderCreateMatch[2].trim(), clientName: orderCreateMatch[3].trim(), unitPrice: parseValue(orderCreateMatch[4]) }, raw: text };
  if (ORDER_OPEN_QUERY_PATTERN.test(text)) return { intent: 'ORDER_OPEN_QUERY', entities: {}, raw: text };
  if (SALES_WEEK_QUERY_PATTERN.test(text)) return { intent: 'SALES_WEEK_QUERY', entities: {}, raw: text };

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
    case 'ORDER_CREATE':
    case 'ORDER_OPEN_QUERY':
    case 'SALES_WEEK_QUERY':
      return '';
    case 'QUOTE_CREATE':
    case 'QUOTE_STATUS_QUERY':
    case 'QUOTE_EXPIRING_QUERY':
    case 'COMMISSION_MONTH_QUERY':
    case 'COMMISSION_PAY':
    case 'DELIVERY_STATUS_QUERY':
    case 'DELIVERY_PENDING_QUERY':
    case 'CONTRACT_DUE_QUERY':
    case 'CONTRACT_STATUS_QUERY':
    case 'FREE_SLOT_QUERY':
    case 'APPOINTMENT_CREATE':
    case 'APPOINTMENT_TODAY_QUERY':
      return '';
    default:
      return '';
  }
}
