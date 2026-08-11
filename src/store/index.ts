import { create } from 'zustand';
import { mockTransactions, mockTasks, mockCalendarEvents } from '../data/mock';
import {
  guessBusinessTypeFallback,
  guessBusinessNameFallback,
} from '../engine/openOnboardingEngine';
import { buildOnboardingContextDTO, OnboardingContextDTO } from '../ai/onboardingContext';
import { OnboardingExtractionResult, CategorySuggestion, RecommendedPlugin } from '../ai/types';
import { canActivatePlugin, PluginId } from '../plugins/registry';
import { generateId } from '../utils/id';

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  /** Cliente central associado à receita, quando aplicável. */
  clientId?: string;
  supplierId?: string;
  supplierDueDate?: string;
  supplierPaid?: boolean;
  stockItemId?: string;
  stockQuantity?: number;
  stockReceived?: boolean;
  orderId?: string;
  contractId?: string;
  expectedDate?: string;
  confirmed?: boolean;
  /** Funcionário vinculado (ex: comissão paga). */
  employeeId?: string;
}
export interface Task {
  id: string;
  description: string;
  done: boolean;
  dueDate: string | null;
  dueDateLabel?: string | null;
  priority: 'alta' | 'media' | 'baixa';
  subtasks: { id: string; text: string; done: boolean }[];
  tags: string[];
  createdAt: string;
  employeeId?: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  time: string | null;
  description: string;
  done: boolean;
  type: 'event' | 'task';
}

export interface EstoqueItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  minAlert: number;
}

export interface ClienteItem {
  id: string;
  name: string;
  contact: string;
  notes: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  quantity: number;
  reason: string;
  createdAt: string;
  sourceTransactionId?: string;
  sourceOrderId?: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  stockItemId?: string;
}

export type OrderStatus = 'aberto' | 'concluido' | 'cancelado';

export type DeliveryStatus = 'a caminho' | 'entregue' | 'cancelada';

export interface Entrega {
  id: string;
  orderId: string;
  employeeId?: string;
  address: string;
  status: DeliveryStatus;
  estimatedDate: string;
  freightValue?: number;
  financeTransactionId?: string;
  calendarEventId?: string;
  createdAt: string;
}

export type ContractPeriod = 'mensal' | 'trimestral' | 'semestral' | 'anual';
export type ContractStatus = 'ativo' | 'cancelado';

export interface Contrato {
  id: string;
  clientId: string;
  value: number;
  period: ContractPeriod;
  startDate: string;
  status: ContractStatus;
  nextBillingDate: string;
  createdAt: string;
}

export interface Pedido {
  id: string;
  clientId?: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  date: string;
  createdAt: string;
  financeTransactionId?: string;
  stockDeductions?: Array<{ stockItemId: string; quantity: number }>;
  employeeId?: string;
}

export type QuoteStatus = 'pendente' | 'aprovado' | 'recusado' | 'expirado';

export interface Orcamento {
  id: string;
  clientId?: string;
  items: OrderItem[];
  total: number;
  validUntil: string;
  status: QuoteStatus;
  createdAt: string;
  orderId?: string;
}

export interface FornecedorItem {
  id: string;
  name: string;
  contact: string;
  paymentTerm: string;
  notes: string;
}

export interface EmployeeItem {
  id: string;
  name: string;
  role: string;
  contact: string;
  /** Percentual fixo de comissão sobre pedidos concluídos (0 = sem comissão). */
  commissionRate?: number;
  createdAt: string;
}

/**
 * Comissão devida a um funcionário por um pedido concluído. É calculada e
 * registrada automaticamente na conclusão do pedido (ver `applyOrderUpdate`),
 * e pode ser apenas fechada operacionalmente pelo usuário
 * (`closeEmployeeCommission`). O fechamento não lança nada no Financeiro.
 */
export interface CommissionEntry {
  id: string;
  employeeId: string;
  orderId: string;
  amount: number;
  /** Percentual aplicado no momento do cálculo, guardado para referência. */
  rate: number;
  /** Mês de competência no formato AAAA-MM, extraído da conclusão do pedido. */
  month: string;
  paid: boolean;
  paidAt?: string;
  financeTransactionId?: string;
  createdAt: string;
}

/**
 * Item genérico dos 9 plugins com tela mínima (ver `app/plugins/[id].tsx`
 * e `src/plugins/registry.ts`). Os campos concretos variam por plugin
 * (definidos em `PluginDefinition.fields`) e ficam em `values`.
 */
export interface GenericPluginItem {
  id: string;
  values: Record<string, string>;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  text: string;
  actions?: Array<{ label: string; onPress?: () => void }>;
  timestamp: Date;
}

export interface AppStore {
  hasSeenSplash: boolean;
  setHasSeenSplash: (value: boolean) => void;

  onboardingCompleted: boolean;
  businessName: string;
  businessType: string;
  openAnswers: Record<string, string>;
  /** DTO único, pronto para a futura integração com IA (ver src/ai/). */
  onboardingContext: OnboardingContextDTO | null;

  applyOpenOnboardingConfig: (answers: Record<string, string>) => void;

  /**
   * Resultado (mock ou, no futuro, real) da extração de categorias/tags do
   * onboarding — ver `OnboardingExtractionResult` em `src/ai/types.ts`.
   * Guardado por completo para referência, além de "espalhado" nos campos
   * abaixo para consumo direto pelos 3 módulos.
   */
  onboardingExtraction: OnboardingExtractionResult | null;

  /**
   * Resultado calculado na tela de celebração (`app/celebration.tsx`),
   * aguardando confirmação do usuário na tela de resumo
   * (`app/onboarding-summary.tsx`). Só vira `onboardingExtraction`
   * definitivo (e só reflete nos 3 módulos) quando o usuário confirma.
   */
  pendingOnboardingExtraction: OnboardingExtractionResult | null;
  setPendingOnboardingExtraction: (result: OnboardingExtractionResult | null) => void;

  /** Categorias/tags aplicadas aos 3 módulos existentes, com origin preservado. */
  financialExpenseCategories: CategorySuggestion[];
  financialIncomeCategories: CategorySuggestion[];
  taskTags: CategorySuggestion[];
  calendarEventTypes: CategorySuggestion[];
  /** Palavra/expressão -> nome de categoria, para auto-classificação futura. */
  keywordMap: Record<string, string>;

  recommendedPlugins: RecommendedPlugin[];
  /**
   * Plugins ativos (ids do catálogo fechado em `src/plugins/registry.ts`).
   * Os 3 módulos fixos NÃO fazem parte deste array. Escolha inicial vem da
   * tela de resumo do onboarding ('Ativar agora' ou 'Talvez depois'), mas o
   * usuário pode ativar/desativar a qualquer momento pela aba Apps.
   */
  activatedPlugins: string[];
  setPluginActivation: (pluginId: string, activated: boolean) => void;

  /** Sugestões do onboarding dispensadas manualmente na aba Apps. */
  dismissedPluginSuggestions: string[];
  dismissPluginSuggestion: (pluginId: string) => void;

  /** Dados dos 2 plugins com CRUD completo. */
  estoqueItems: EstoqueItem[];
  addEstoqueItem: (item: Omit<EstoqueItem, 'id'>) => void;
  updateEstoqueItem: (id: string, item: Omit<EstoqueItem, 'id'>) => void;
  removeEstoqueItem: (id: string) => void;
  stockMovements: StockMovement[];
  moveEstoqueItem: (itemId: string, quantity: number, reason?: string, sourceTransactionId?: string) => boolean;
  receiveStockFromPurchase: (transactionId: string, itemId: string, quantity: number) => boolean;

  pedidos: Pedido[];
  addPedido: (pedido: Omit<Pedido, 'id' | 'financeTransactionId' | 'stockDeductions'>) => string;
  updatePedido: (id: string, updates: Partial<Omit<Pedido, 'id'>>) => boolean;
  completePedido: (id: string) => boolean;
  removePedido: (id: string) => void;

  entregas: Entrega[];
  addEntrega: (entrega: Omit<Entrega, 'id' | 'financeTransactionId' | 'calendarEventId'>, createFreightExpense?: boolean) => string | null;
  updateEntrega: (id: string, updates: Partial<Omit<Entrega, 'id'>>) => boolean;
  removeEntrega: (id: string) => void;

  orcamentos: Orcamento[];
  addOrcamento: (orcamento: Omit<Orcamento, 'id' | 'orderId'>) => string;
  updateOrcamento: (id: string, updates: Partial<Omit<Orcamento, 'id'>>) => void;
  approveOrcamento: (id: string) => string | null;
  refreshOrcamentos: () => void;

  clienteItems: ClienteItem[];
  addClienteItem: (item: Omit<ClienteItem, 'id'>) => string;
  updateClienteItem: (id: string, item: Omit<ClienteItem, 'id'>) => void;
  removeClienteItem: (id: string) => void;
  linkTransactionToClient: (transactionId: string, clientId: string | undefined) => void;

  contratos: Contrato[];
  addContrato: (contrato: Omit<Contrato, 'id' | 'nextBillingDate'>) => string | null;
  updateContrato: (id: string, updates: Partial<Omit<Contrato, 'id'>>) => boolean;
  removeContrato: (id: string) => void;
  refreshContratos: () => void;
  markTransactionReceived: (transactionId: string, received: boolean) => void;

  fornecedorItems: FornecedorItem[];
  addFornecedorItem: (item: Omit<FornecedorItem, 'id'>) => string;
  updateFornecedorItem: (id: string, item: Omit<FornecedorItem, 'id'>) => void;
  removeFornecedorItem: (id: string) => void;
  linkTransactionToSupplier: (transactionId: string, supplierId: string | undefined, updates?: Pick<Transaction, 'supplierDueDate' | 'supplierPaid'>) => void;
  markSupplierTransactionPaid: (transactionId: string, paid: boolean) => void;

employeeItems: EmployeeItem[];
  addEmployeeItem: (item: Omit<EmployeeItem, 'id'>) => string;
  updateEmployeeItem: (id: string, item: Omit<EmployeeItem, 'id'>) => void;
  removeEmployeeItem: (id: string) => void;

  commissions: CommissionEntry[];
  /**
   * Fecha TODAS as comissões pendentes de um funcionário sem criar ou alterar
   * transações no Financeiro. Requer ação manual do usuário.
   */
  closeEmployeeCommission: (employeeId: string) => void;

  /**
   * Dados dos 9 plugins com tela mínima genérica, indexados por
   * `PluginId`. Preservados mesmo se o plugin for desativado, para
   * reaparecerem caso o usuário reative depois.
   */
  genericPluginItems: Partial<Record<PluginId, GenericPluginItem[]>>;
  addGenericPluginItem: (pluginId: PluginId, values: Record<string, string>) => void;
  removeGenericPluginItem: (pluginId: PluginId, itemId: string) => void;

  /**
   * Aplica o resultado da extração (mock hoje, IA real no futuro) aos 3
   * módulos existentes e marca o onboarding como concluído.
   */
  applyOnboardingExtraction: (result: OnboardingExtractionResult) => void;

  transactions: Transaction[];
  addTransaction: (t: Omit<Transaction, 'id'>) => string;
  removeTransaction: (id: string) => void;
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, 'id'>>) => void;
  removeTransactions: (ids: string[]) => void;

  tasks: Task[];
  addTask: (t: Omit<Task, 'id'>) => void;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id'>>) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;

  customTaskTags: string[];
  addCustomTaskTag: (tag: string) => void;
  removeCustomTaskTag: (tag: string) => void;

  events: CalendarEvent[];
  addEvent: (e: Omit<CalendarEvent, 'id' | 'done'> & { done?: boolean }) => void;
  toggleEvent: (id: string) => void;
  removeEvent: (id: string) => void;
  updateEvent: (id: string, updates: Partial<Omit<CalendarEvent, 'id'>>) => void;

  messages: ChatMessage[];
  addMessage: (m: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
}

function getOrderStockDeductions(order: Pedido, stockItems: EstoqueItem[]): Array<{ stockItemId: string; quantity: number }> {
  const deductions = new Map<string, number>();
  order.items.forEach((item) => {
    const normalizedName = item.name.trim().toLowerCase();
    const stockItem = item.stockItemId
      ? stockItems.find((candidate) => candidate.id === item.stockItemId)
      : stockItems.find((candidate) => candidate.name.trim().toLowerCase() === normalizedName);
    if (stockItem && item.quantity > 0) deductions.set(stockItem.id, (deductions.get(stockItem.id) ?? 0) + item.quantity);
  });
  return [...deductions].map(([stockItemId, quantity]) => ({ stockItemId, quantity }));
}

function isQuoteExpired(validUntil: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const validity = new Date(`${validUntil}T00:00:00`);
  return validity.getTime() < today.getTime();
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTransactionDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}`;
}

function advanceContractDate(isoDate: string, period: ContractPeriod): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const months = period === 'mensal' ? 1 : period === 'trimestral' ? 3 : period === 'semestral' ? 6 : 12;
  date.setMonth(date.getMonth() + months);
  return toLocalIsoDate(date);
}

function applyOrderUpdate(state: AppStore, id: string, updates: Partial<Omit<Pedido, 'id'>>): Partial<AppStore> | null {
  const current = state.pedidos.find((pedido) => pedido.id === id);
  if (!current) return null;
  const next: Pedido = { ...current, ...updates, id };
  const wasCompleted = current.status === 'concluido';
  const willBeCompleted = next.status === 'concluido';
  const oldDeductions = current.stockDeductions ?? [];
  const newDeductions = willBeCompleted ? getOrderStockDeductions(next, state.estoqueItems) : [];
  const deltas = new Map<string, number>();
  oldDeductions.forEach((entry) => deltas.set(entry.stockItemId, (deltas.get(entry.stockItemId) ?? 0) + entry.quantity));
  newDeductions.forEach((entry) => deltas.set(entry.stockItemId, (deltas.get(entry.stockItemId) ?? 0) - entry.quantity));
  for (const [stockItemId, delta] of deltas) {
    const item = state.estoqueItems.find((stockItem) => stockItem.id === stockItemId);
    if (!item || item.quantity + delta < 0) return null;
  }
  const nextItems = state.estoqueItems.map((item) => {
    const delta = deltas.get(item.id) ?? 0;
    return delta === 0 ? item : { ...item, quantity: item.quantity + delta };
  });
  const nextMovements = [...state.stockMovements];
  deltas.forEach((delta, stockItemId) => {
    if (delta !== 0) nextMovements.unshift({ id: generateId('mov_'), itemId: stockItemId, quantity: delta, reason: 'Pedido concluído atualizado', createdAt: new Date().toISOString(), sourceOrderId: id });
  });
  let transactionId = current.financeTransactionId;
  let transactions = state.transactions;
  if (willBeCompleted) {
    transactionId = transactionId ?? generateId('txn_');
    const transaction: Transaction = { id: transactionId, date: next.date, description: `Pedido ${id}`, amount: next.total, category: 'Receita', clientId: next.clientId, orderId: id };
    const exists = transactions.some((item) => item.id === transactionId);
    transactions = exists ? transactions.map((item) => item.id === transactionId ? transaction : item) : [transaction, ...transactions];
  } else if (wasCompleted && transactionId) {
    transactions = transactions.filter((item) => item.id !== transactionId);
    transactionId = undefined;
  }
  let commissions = state.commissions;
  if (willBeCompleted && !wasCompleted && next.employeeId) {
    const employee = state.employeeItems.find((e) => e.id === next.employeeId);
    const rate = employee?.commissionRate ?? 0;
    if (rate > 0) {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const entry: CommissionEntry = {
        id: generateId('com_'), employeeId: next.employeeId, orderId: id,
        amount: next.total * rate / 100, rate, month, paid: false,
        createdAt: now.toISOString(),
      };
      commissions = [entry, ...commissions];
    }
  } else if (!willBeCompleted && wasCompleted) {
    commissions = commissions.filter((c) => !(c.orderId === id && !c.paid));
  }
  return { pedidos: state.pedidos.map((pedido) => pedido.id === id ? { ...next, financeTransactionId: transactionId, stockDeductions: newDeductions } : pedido), estoqueItems: nextItems, stockMovements: nextMovements, transactions, commissions };
}

export const useAppStore = create<AppStore>((set) => ({
  hasSeenSplash: false,
  setHasSeenSplash: (value) => set({ hasSeenSplash: value }),

  onboardingCompleted: false,
  businessName: '',
  businessType: '',
  openAnswers: {},
  onboardingContext: null,

  applyOpenOnboardingConfig: (answers) =>
    set({
      openAnswers: answers,
      businessType: guessBusinessTypeFallback(answers),
      businessName: guessBusinessNameFallback(answers),
      onboardingContext: buildOnboardingContextDTO(answers),
    }),

  onboardingExtraction: null,
  pendingOnboardingExtraction: null,
  setPendingOnboardingExtraction: (result) => set({ pendingOnboardingExtraction: result }),
  financialExpenseCategories: [],
  financialIncomeCategories: [],
  taskTags: [],
  calendarEventTypes: [],
  keywordMap: {},
  recommendedPlugins: [],
  activatedPlugins: [],
  setPluginActivation: (pluginId, activated) =>
    set((s) => {
      if (activated) {
        if (!canActivatePlugin(pluginId as PluginId, s.activatedPlugins).ok) return s;
      }
      return {
      activatedPlugins: activated
        ? [...new Set([...s.activatedPlugins, pluginId])]
        : s.activatedPlugins.filter((id) => id !== pluginId),
      };
    }),

  dismissedPluginSuggestions: [],
  dismissPluginSuggestion: (pluginId) =>
    set((s) => ({
      dismissedPluginSuggestions: [...new Set([...s.dismissedPluginSuggestions, pluginId])],
    })),

  estoqueItems: [],
  addEstoqueItem: (item) =>
    set((s) => ({
      estoqueItems: [{ ...item, id: Date.now().toString() }, ...s.estoqueItems],
    })),
  updateEstoqueItem: (id, item) =>
    set((s) => ({
      estoqueItems: s.estoqueItems.map((i) => (i.id === id ? { ...item, id } : i)),
    })),
  removeEstoqueItem: (id) =>
    set((s) => ({ estoqueItems: s.estoqueItems.filter((i) => i.id !== id) })),
  stockMovements: [],
  moveEstoqueItem: (itemId, quantity, reason = 'Ajuste manual', sourceTransactionId) => {
    let moved = false;
    set((s) => {
      const item = s.estoqueItems.find((i) => i.id === itemId);
      if (!item || !Number.isFinite(quantity) || quantity === 0 || item.quantity + quantity < 0) return s;
      moved = true;
      return {
        estoqueItems: s.estoqueItems.map((i) => i.id === itemId ? { ...i, quantity: i.quantity + quantity } : i),
        stockMovements: [{ id: generateId('mov_'), itemId, quantity, reason: reason.trim() || 'Ajuste manual', createdAt: new Date().toISOString(), sourceTransactionId }, ...s.stockMovements],
      };
    });
    return moved;
  },
  receiveStockFromPurchase: (transactionId, itemId, quantity) => {
    let received = false;
    set((s) => {
      const transaction = s.transactions.find((t) => t.id === transactionId);
      const item = s.estoqueItems.find((i) => i.id === itemId);
      if (!transaction || !item || transaction.stockReceived || !Number.isFinite(quantity) || quantity <= 0) return s;
      received = true;
      return {
        estoqueItems: s.estoqueItems.map((i) => i.id === itemId ? { ...i, quantity: i.quantity + quantity } : i),
        stockMovements: [{ id: generateId('mov_'), itemId, quantity, reason: 'Compra recebida', createdAt: new Date().toISOString(), sourceTransactionId: transactionId }, ...s.stockMovements],
        transactions: s.transactions.map((t) => t.id === transactionId ? { ...t, stockItemId: itemId, stockQuantity: quantity, stockReceived: true } : t),
      };
    });
    return received;
  },

  pedidos: [],
  addPedido: (pedido) => {
    const id = generateId('ord_');
    set((s) => ({ pedidos: [{ ...pedido, id }, ...s.pedidos] }));
    return id;
  },
  updatePedido: (id, updates) => {
    let updated = false;
    set((s) => {
      const result = applyOrderUpdate(s, id, updates);
      if (!result) return s;
      updated = true;
      return result;
    });
    return updated;
  },
  completePedido: (id): boolean => {
    let completed = false;
    set((s) => {
      const result = applyOrderUpdate(s, id, { status: 'concluido' });
      if (!result) return s;
      completed = true;
      return result;
    });
    return completed;
  },
  removePedido: (id) => set((s) => {
    const pedido = s.pedidos.find((item) => item.id === id);
    if (!pedido) return s;
    if (pedido.status === 'concluido') {
      const restoredItems = s.estoqueItems.map((item) => {
        const deduction = pedido.stockDeductions?.find((entry) => entry.stockItemId === item.id);
        return deduction ? { ...item, quantity: item.quantity + deduction.quantity } : item;
      });
      const deliveries = s.entregas.filter((delivery) => delivery.orderId === id);
      const deliveryEventIds = new Set(deliveries.map((delivery) => delivery.calendarEventId).filter(Boolean));
      const deliveryTransactionIds = new Set(deliveries.map((delivery) => delivery.financeTransactionId).filter(Boolean));
      return { pedidos: s.pedidos.filter((item) => item.id !== id), entregas: s.entregas.filter((delivery) => delivery.orderId !== id), events: s.events.filter((event) => !deliveryEventIds.has(event.id)), estoqueItems: restoredItems, transactions: pedido.financeTransactionId ? s.transactions.filter((item) => item.id !== pedido.financeTransactionId && !deliveryTransactionIds.has(item.id)) : s.transactions.filter((item) => !deliveryTransactionIds.has(item.id)), commissions: s.commissions.filter((c) => !(c.orderId === id && !c.paid)) };
    }
    return { pedidos: s.pedidos.filter((item) => item.id !== id) };
  }),

  entregas: [],
  addEntrega: (entrega, createFreightExpense = false) => {
    let deliveryId: string | null = null;
    set((s) => {
      if (!s.pedidos.some((pedido) => pedido.id === entrega.orderId && pedido.status === 'concluido') || s.entregas.some((item) => item.orderId === entrega.orderId && item.status !== 'cancelada')) return s;
      deliveryId = generateId('del_');
      const calendarEventId = generateId('cal_del_');
      const financeTransactionId = createFreightExpense && (entrega.freightValue ?? 0) > 0 ? generateId('txn_') : undefined;
      const order = s.pedidos.find((pedido) => pedido.id === entrega.orderId)!;
      const delivery: Entrega = { ...entrega, id: deliveryId, calendarEventId, financeTransactionId, createdAt: entrega.createdAt || new Date().toISOString() };
      const event: CalendarEvent = { id: calendarEventId, date: entrega.estimatedDate, time: null, description: `Entrega do pedido ${order.id.slice(-6)}`, done: false, type: 'event' };
      const transaction: Transaction | undefined = financeTransactionId ? { id: financeTransactionId, date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), description: `Frete do pedido ${order.id.slice(-6)}`, amount: -(entrega.freightValue ?? 0), category: 'Frete', orderId: order.id } : undefined;
      return { entregas: [delivery, ...s.entregas], events: [...s.events, event], transactions: transaction ? [transaction, ...s.transactions] : s.transactions };
    });
    return deliveryId;
  },
  updateEntrega: (id, updates) => {
    let updated = false;
    set((s) => {
      const current = s.entregas.find((item) => item.id === id);
      if (!current) return s;
      updated = true;
      const next = { ...current, ...updates, id };
      return {
        entregas: s.entregas.map((item) => item.id === id ? next : item),
        events: next.calendarEventId ? s.events.map((event) => event.id === next.calendarEventId ? { ...event, date: next.estimatedDate, done: next.status !== 'a caminho' } : event) : s.events,
        transactions: next.financeTransactionId && next.freightValue !== current.freightValue ? s.transactions.map((transaction) => transaction.id === next.financeTransactionId ? { ...transaction, amount: -(next.freightValue ?? 0) } : transaction) : s.transactions,
      };
    });
    return updated;
  },
  removeEntrega: (id) => set((s) => {
    const delivery = s.entregas.find((item) => item.id === id);
    if (!delivery) return s;
    return { entregas: s.entregas.filter((item) => item.id !== id), events: delivery.calendarEventId ? s.events.filter((event) => event.id !== delivery.calendarEventId) : s.events, transactions: delivery.financeTransactionId ? s.transactions.filter((transaction) => transaction.id !== delivery.financeTransactionId) : s.transactions };
  }),

  orcamentos: [],
  addOrcamento: (orcamento) => {
    const id = generateId('orc_');
    set((s) => ({ orcamentos: [{ ...orcamento, id }, ...s.orcamentos] }));
    return id;
  },
  updateOrcamento: (id, updates) =>
    set((s) => ({ orcamentos: s.orcamentos.map((orcamento) => orcamento.id === id ? { ...orcamento, ...updates, id } : orcamento) })),
  approveOrcamento: (id) => {
    let orderId: string | null = null;
    set((s) => {
      const quote = s.orcamentos.find((orcamento) => orcamento.id === id);
      if (!quote || quote.orderId || quote.status !== 'pendente' || isQuoteExpired(quote.validUntil)) return s;
      orderId = generateId('ord_');
      const order: Pedido = { id: orderId, clientId: quote.clientId, items: quote.items, total: quote.total, status: 'aberto', date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), createdAt: new Date().toISOString() };
      return { pedidos: [order, ...s.pedidos], orcamentos: s.orcamentos.map((orcamento) => orcamento.id === id ? { ...orcamento, status: 'aprovado' as const, orderId: order.id } : orcamento) };
    });
    return orderId;
  },
  refreshOrcamentos: () =>
    set((s) => ({ orcamentos: s.orcamentos.map((orcamento) => orcamento.status === 'pendente' && isQuoteExpired(orcamento.validUntil) ? { ...orcamento, status: 'expirado' as const } : orcamento) })),

  clienteItems: [],
  addClienteItem: (item) => {
    const id = generateId('cli_');
    set((s) => ({ clienteItems: [{ ...item, id }, ...s.clienteItems] }));
    return id;
  },
  updateClienteItem: (id, item) =>
    set((s) => ({
      clienteItems: s.clienteItems.map((i) => (i.id === id ? { ...item, id } : i)),
    })),
  removeClienteItem: (id) =>
    set((s) => {
      const contractIds = new Set(s.contratos.filter((contrato) => contrato.clientId === id).map((contrato) => contrato.id));
      return {
        clienteItems: s.clienteItems.filter((i) => i.id !== id),
        transactions: s.transactions.filter((transaction) => !contractIds.has(transaction.contractId ?? '')).map((transaction) => transaction.clientId === id ? { ...transaction, clientId: undefined } : transaction),
        events: s.events.filter((event) => ![...contractIds].some((contractId) => event.id.startsWith(`contract-due:${contractId}:`))),
        contratos: s.contratos.filter((contrato) => !contractIds.has(contrato.id)),
      };
    }),
  linkTransactionToClient: (transactionId, clientId) =>
    set((s) => ({
      transactions: s.transactions.map((t) =>
        t.id === transactionId ? { ...t, clientId } : t
      ),
    })),

  contratos: [],
  addContrato: (contrato) => {
    let id: string | null = null;
    set((s) => {
      if (!s.clienteItems.some((client) => client.id === contrato.clientId) || contrato.value <= 0) return s;
      id = generateId('ctr_');
      return { contratos: [{ ...contrato, id, nextBillingDate: contrato.startDate }, ...s.contratos] };
    });
    return id;
  },
  updateContrato: (id, updates) => {
    let updated = false;
    set((s) => {
      const current = s.contratos.find((contrato) => contrato.id === id);
      if (!current || (updates.clientId && !s.clienteItems.some((client) => client.id === updates.clientId))) return s;
      updated = true;
      const next = { ...current, ...updates, id };
      return { contratos: s.contratos.map((contrato) => contrato.id === id ? next : contrato), events: next.status === 'cancelado' ? s.events.filter((event) => !event.id.startsWith(`contract-due:${id}:`)) : s.events };
    });
    return updated;
  },
  removeContrato: (id) => set((s) => ({ contratos: s.contratos.filter((contrato) => contrato.id !== id), transactions: s.transactions.filter((transaction) => transaction.contractId !== id), events: s.events.filter((event) => !event.id.startsWith(`contract-due:${id}:`)) })),
  refreshContratos: () => set((s) => {
    const today = toLocalIsoDate(new Date());
    let changed = false;
    const transactions = [...s.transactions];
    const events = [...s.events];
    const contratos = s.contratos.map((contrato) => {
      if (contrato.status !== 'ativo') return contrato;
      let nextBillingDate = contrato.nextBillingDate;
      while (nextBillingDate <= today) {
        const expectedDate = nextBillingDate;
        const exists = transactions.some((transaction) => transaction.contractId === contrato.id && transaction.expectedDate === expectedDate);
        if (!exists) {
          const transactionId = generateId('txn_');
          transactions.unshift({ id: transactionId, date: formatTransactionDate(expectedDate), description: `Assinatura ${contrato.id.slice(-6)}`, amount: contrato.value, category: 'Receita', clientId: contrato.clientId, contractId: contrato.id, expectedDate, confirmed: false });
          events.push({ id: `contract-due:${contrato.id}:${expectedDate}`, date: expectedDate, time: null, description: `Cobrança da assinatura ${contrato.id.slice(-6)}`, done: false, type: 'event' });
          changed = true;
        }
        nextBillingDate = advanceContractDate(nextBillingDate, contrato.period);
        changed = true;
      }
      const nextEventId = `contract-due:${contrato.id}:${nextBillingDate}`;
      if (!events.some((event) => event.id === nextEventId)) {
        events.push({ id: nextEventId, date: nextBillingDate, time: null, description: `Cobrança da assinatura ${contrato.id.slice(-6)}`, done: false, type: 'event' });
        changed = true;
      }
      return nextBillingDate === contrato.nextBillingDate ? contrato : { ...contrato, nextBillingDate };
    });
    return changed ? { contratos, transactions, events } : s;
  }),
  markTransactionReceived: (transactionId, received) => set((s) => {
    const transaction = s.transactions.find((item) => item.id === transactionId);
    if (!transaction) return s;
    const eventId = transaction.contractId && transaction.expectedDate ? `contract-due:${transaction.contractId}:${transaction.expectedDate}` : undefined;
    return {
      transactions: s.transactions.map((item) => item.id === transactionId ? { ...item, confirmed: received } : item),
      events: eventId ? s.events.map((event) => event.id === eventId ? { ...event, done: received } : event) : s.events,
    };
  }),

  fornecedorItems: [],
  addFornecedorItem: (item) => {
    const id = generateId('sup_');
    set((s) => ({ fornecedorItems: [{ ...item, id }, ...s.fornecedorItems] }));
    return id;
  },
  updateFornecedorItem: (id, item) =>
    set((s) => ({ fornecedorItems: s.fornecedorItems.map((i) => i.id === id ? { ...item, id } : i) })),
  removeFornecedorItem: (id) =>
    set((s) => ({
      fornecedorItems: s.fornecedorItems.filter((i) => i.id !== id),
      transactions: s.transactions.map((t) => t.supplierId === id ? { ...t, supplierId: undefined, supplierDueDate: undefined, supplierPaid: undefined } : t),
    })),
  linkTransactionToSupplier: (transactionId, supplierId, updates = {}) =>
    set((s) => ({
      transactions: s.transactions.map((t) => t.id === transactionId ? { ...t, supplierId, ...updates } : t),
    })),
  markSupplierTransactionPaid: (transactionId, paid) =>
    set((s) => ({ transactions: s.transactions.map((t) => t.id === transactionId ? { ...t, supplierPaid: paid } : t) })),

  employeeItems: [],
  addEmployeeItem: (item) => {
    const id = generateId('emp_');
    set((s) => ({ employeeItems: [{ ...item, id }, ...s.employeeItems] }));
    return id;
  },
updateEmployeeItem: (id, item) =>
    set((s) => ({ employeeItems: s.employeeItems.map((employee) => employee.id === id ? { ...item, id } : employee) })),
  removeEmployeeItem: (id) =>
    set((s) => ({
      employeeItems: s.employeeItems.filter((employee) => employee.id !== id),
      tasks: s.tasks.map((task) => task.employeeId === id ? { ...task, employeeId: undefined } : task),
      pedidos: s.pedidos.map((pedido) => pedido.employeeId === id ? { ...pedido, employeeId: undefined } : pedido),
      entregas: s.entregas.map((delivery) => delivery.employeeId === id ? { ...delivery, employeeId: undefined } : delivery),
      commissions: s.commissions.filter((c) => !(c.employeeId === id && !c.paid)),
    })),

  commissions: [],
  closeEmployeeCommission: (employeeId) =>
    set((s) => {
      const pending = s.commissions.filter((c) => c.employeeId === employeeId && !c.paid);
      if (pending.length === 0) return s;
      const now = new Date().toISOString();
      return {
        commissions: s.commissions.map((c) => c.employeeId === employeeId && !c.paid
          ? { ...c, paid: true, paidAt: now }
          : c),
      };
    }),

  genericPluginItems: {},
  addGenericPluginItem: (pluginId, values) =>
    set((s) => ({
      genericPluginItems: {
        ...s.genericPluginItems,
        [pluginId]: [
          { id: Date.now().toString(), values },
          ...(s.genericPluginItems[pluginId] ?? []),
        ],
      },
    })),
  removeGenericPluginItem: (pluginId, itemId) =>
    set((s) => ({
      genericPluginItems: {
        ...s.genericPluginItems,
        [pluginId]: (s.genericPluginItems[pluginId] ?? []).filter((i) => i.id !== itemId),
      },
    })),

  applyOnboardingExtraction: (result) =>
    set((s) => ({
      onboardingExtraction: result,
      pendingOnboardingExtraction: null,
      businessName: result.businessName ?? s.businessName,
      financialExpenseCategories: result.coreCategories.financial.expense,
      financialIncomeCategories: result.coreCategories.financial.income,
      taskTags: result.coreCategories.taskTags,
      calendarEventTypes: result.coreCategories.calendarEventTypes,
      keywordMap: result.keywordMap,
      recommendedPlugins: result.recommendedPlugins,
      onboardingCompleted: true,
    })),

  transactions: mockTransactions,
  addTransaction: (t) => {
    const id = generateId('txn_');
    set((s) => ({ transactions: [{ ...t, id }, ...s.transactions] }));
    return id;
  },
  removeTransaction: (id) =>
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),
  updateTransaction: (id, updates) =>
    set((s) => ({
      transactions: s.transactions.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),
  removeTransactions: (ids) =>
    set((s) => ({
      transactions: s.transactions.filter((t) => !ids.includes(t.id)),
    })),

  tasks: mockTasks as Task[],
  addTask: (t) =>
    set((s) => ({
      tasks: [{ ...t, id: Date.now().toString() } as Task, ...s.tasks],
    })),
  updateTask: (id, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } as Task : t)),
    })),
  toggleTask: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } as Task : t)),
    })),
  removeTask: (id) =>
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  customTaskTags: ['Peças', 'Clientes', 'Financeiro', 'Estoque', 'Fornecedor'],
  addCustomTaskTag: (tag) =>
    set((s) => {
      if (s.customTaskTags.includes(tag)) return s;
      return { customTaskTags: [...s.customTaskTags, tag] };
    }),
  removeCustomTaskTag: (tag) =>
    set((s) => ({
      customTaskTags: s.customTaskTags.filter((t) => t !== tag),
      tasks: s.tasks.map((task) => ({
        ...task,
        tags: task.tags.filter((t) => t !== tag),
      })) as Task[],
    })),

  events: mockCalendarEvents,
  addEvent: (e) =>
    set((s) => ({
      events: [...s.events, { ...e, done: e.done ?? false, id: Date.now().toString() }],
    })),
  toggleEvent: (id) =>
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, done: !e.done } : e)),
    })),
  removeEvent: (id) =>
    set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
  updateEvent: (id, updates) =>
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),

  messages: [],
  addMessage: (m) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { ...m, id: Date.now().toString(), timestamp: new Date() },
      ],
    })),
  clearMessages: () => set({ messages: [] }),
}));
