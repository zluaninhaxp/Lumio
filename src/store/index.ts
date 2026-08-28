import { create } from 'zustand';
import {
  guessBusinessTypeFallback,
  guessBusinessNameFallback,
} from '../engine/openOnboardingEngine';
import { buildOnboardingContextDTO, OnboardingContextDTO } from '../ai/onboardingContext';
import { OnboardingExtractionResult, CategorySuggestion, RecommendedPlugin } from '../ai/types';
import { canActivatePlugin, PluginId } from '../plugins/registry';
import { generateId } from '../utils/id';
import type { BusinessTaxonomy } from '../engine/taxonomy/types';
import { migrateV1toV2 } from '../engine/taxonomy/migrateV1toV2';

export interface Transaction {
  id: string;
  source?: 'manual' | 'chat';
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
  /**
   * Id da `Task` que originou/está vinculada a esta movimentação, quando o
   * lançamento veio de uma obrigação financeira criada via chat ("tenho
   * que pagar o fornecedor até sexta"). Relação bidirecional: a `Task`
   * correspondente possui `financeTransactionId` apontando de volta.
   * Concluir a tarefa NÃO apaga o lançamento (o registro financeiro é
   * permanente; ver integração Chat→Financeiro, seção 46).
   */
  taskId?: string;
}
export interface Task {
  id: string;
  description: string;
  source?: 'manual' | 'chat';
  done: boolean;
  dueDate: string | null;
  dueDateLabel?: string | null;
  priority: 'alta' | 'media' | 'baixa';
  subtasks: { id: string; text: string; done: boolean }[];
  tags: string[];
  createdAt: string;
  clientId?: string;
  supplierId?: string;
  employeeId?: string;
  /**
   * Id do `CalendarEvent` que representa esta tarefa no calendário, quando
   * a tarefa foi originada com uma referência temporal (prazo ou data de
   * execução). A relação é bidirecional: o evento correspondente contém
   * `taskId` apontando de volta. Eventos criados a partir de tarefas
   * possuem `source === 'task'` (ver `CalendarEvent.source`).
   *
   * Quando a tarefa NÃO possui representação no calendário (sem data), o
   * campo fica `undefined`. Ver seção 5/6 da especificação de Calendário.
   */
  calendarEventId?: string;
  /**
   * Id da `Transaction` vinculada a esta tarefa quando ela representa uma
   * obrigação financeira criada via chat ("preciso pagar o funcionário até
   * dia 20"). Relação bidirecional: a `Transaction` possui `taskId`.
   * Concluir/excluir a tarefa NÃO apaga o lançamento financeiro.
   */
  financeTransactionId?: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  time: string | null;
  description: string;
  done: boolean;
  type: 'event' | 'task';
  /**
   * Rótulo semântico opcional para eventos (ex.: "Atendimento agendado",
   * "Entrega de fornecedor"). Vem do `coreCategories.calendarEventTypes`
   * gerado no onboarding (ver `applyOnboardingExtraction`) e só é
   * preenchido na criação manual via `EventForm`. Eventos antigos /
   * sintéticos (contratos, entregas, atendimentos) continuam funcionando
   * sem ele. Não confundir com `type` (distinção estrutural event/task).
   */
  eventType?: string;
  clientId?: string;
  supplierId?: string;
  employeeId?: string;
  /**
   * Id da `Task` que originou este evento, quando `source === 'task'`.
   * Permite a sincronização bidirecional (conclusão/edição/exclusão) entre
   * a tarefa e sua representação no calendário. Ver seções 5-11 da
   * especificação de Calendário.
   */
  taskId?: string;
  /**
   * Origem do evento para diferenciar tratamento na sincronização:
   *  - `manual`: criado pelo usuário na tela do Calendário (`EventForm`).
   *  - `chat`: criado a partir de uma mensagem do chat como compromisso
   *    independente (reunião, aniversário, viagem...).
   *  - `task`: criado automaticamente como representação temporal de uma
   *    tarefa com `dueDate`. Está vinculado via `taskId` e segue a
   *    tarefa em edições de data/título/conclusão/exclusão.
   *
   * Eventos antigos/sintéticos (já no store antes desta evolução) e os
   * derivados de plugins (`appointment:`, `contract-due:`, `supplier-due:`,
   * `cal_del_`) continuam sem `source` e NÃO participam da sincronização
   * com `Task` — preservando o comportamento anterior.
   */
  source?: 'manual' | 'chat' | 'task';
  origin?: 'chat';
  /**
   * `true` quando este evento representa um PRAZO (deadline), não uma
   * execução pontual. Ex.: tarefa "pagar funcionário até dia 20" gera
   * evento no calendário com `deadline: true` para diferenciar visualmente
   * de um compromisso. Eventos manuais/independentes não usam este campo.
   * Ver seção 21 da especificação de Calendário.
   */
  deadline?: boolean;
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

export type AppointmentStatus = 'confirmado' | 'concluido' | 'cancelado';

export interface Atendimento {
  id: string;
  clientId?: string;
  quoteId?: string;
  date: string;
  time: string;
  duration: number;
  service: string;
  status: AppointmentStatus;
  calendarEventId: string;
  createdAt: string;
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
  taxonomy: BusinessTaxonomy | null;

  /**
   * Resultado calculado na tela de celebração (`app/celebration.tsx`),
   * aguardando confirmação do usuário na tela de resumo
   * (`app/onboarding-summary.tsx`). Só vira `onboardingExtraction`
   * definitivo (e só reflete nos 3 módulos) quando o usuário confirma.
   *
   * `pendingOnboardingExtractionIsSimulation` marca quando o resultado em
   * `pendingOnboardingExtraction` veio da heurística mock local (sem IA)
   * — usado pela tela de resumo para exibir um aviso explícito de que o
   * relatório é uma simulação, com botão para configurar a chave e gerar
   * a versão real (ver instruções da tarefa, item 3.2).
   */
  pendingOnboardingExtraction: OnboardingExtractionResult | null;
  pendingOnboardingExtractionIsSimulation: boolean;
  setPendingOnboardingExtraction: (
    result: OnboardingExtractionResult | null,
    isSimulation?: boolean
  ) => void;

  /** Categorias/tags aplicadas aos 3 módulos existentes, com origin preservado. */
  financialExpenseCategories: CategorySuggestion[];
  financialIncomeCategories: CategorySuggestion[];
  taskTags: CategorySuggestion[];
  calendarEventTypes: CategorySuggestion[];
  addFinancialExpenseCategory: (label: string) => void;
  addFinancialIncomeCategory: (label: string) => void;
  addCalendarEventType: (label: string) => void;
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

  atendimentos: Atendimento[];
  addAtendimento: (atendimento: Omit<Atendimento, 'id' | 'calendarEventId'>) => string | null;
  updateAtendimento: (id: string, updates: Partial<Omit<Atendimento, 'id'>>) => boolean;
  concludeAtendimento: (id: string) => boolean;
  removeAtendimento: (id: string) => void;

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
  hydrateOnboarding: (data: {
    responses: Record<string, string>;
    context: OnboardingContextDTO | null;
    structuredProfile: OnboardingExtractionResult | null;
    activatedPlugins: string[];
  }) => void;
  /**
   * Zera todos os dados derivados do onboarding no store. Usado pela
   * `AuthContext` quando um usuário loga sem nenhum record persistido
   * (nunca fez onboarding) — evita herdar categorias/tags de outro
   * usuário que estivesse logado na sessão anterior, sem precisar de
   * nova persistência local.
   */
  resetOnboardingState: () => void;

  transactions: Transaction[];
  addTransaction: (t: Omit<Transaction, 'id'>) => string;
  removeTransaction: (id: string) => void;
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, 'id'>>) => void;
  removeTransactions: (ids: string[]) => void;

  tasks: Task[];
  addTask: (t: Omit<Task, 'id'>) => string;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id'>>) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  /**
   * Cria (ou recria) a representação temporal de uma tarefa no calendário.
   * Idempotente: retorna `false` se a tarefa já possuir um `calendarEventId`.
   * Cria um `CalendarEvent` com `type:'task'`, `source:'task'`, `taskId` e
   * `deadline` conforme necessário, e escreve o `calendarEventId` de volta
   * na tarefa — atomicamente. Não chama IA; somente normalização/datas.
   * Ver seções 5/6/15 da especificação de Calendário.
   */
  calendarizeTask: (taskId: string, opts: {
    date: string;
    time?: string | null;
    deadline?: boolean;
    eventType?: string;
  }) => boolean;
  /**
   * Vincula bidirecionalmente uma tarefa a uma transação financeira
   * (obrigações criadas via chat: "tenho que pagar o fornecedor até
   * sexta"). Idempotente. Concluir/remover a tarefa NÃO remove a
   * transação — o registro financeiro permanece (seção 46).
   */
  linkTaskToTransaction: (taskId: string, transactionId: string) => void;

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

function addCategorySuggestion(
  state: AppStore,
  key: 'financialExpenseCategories' | 'financialIncomeCategories' | 'calendarEventTypes',
  label: string,
) {
  const normalized = label.trim();
  if (!normalized || state[key].some((item) => item.label.toLocaleLowerCase() === normalized.toLocaleLowerCase())) return state;
  return { [key]: [...state[key], { label: normalized, origin: 'mentioned' as const }] };
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
  taxonomy: null,
  pendingOnboardingExtraction: null,
  pendingOnboardingExtractionIsSimulation: false,
  setPendingOnboardingExtraction: (result, isSimulation = false) =>
    set({ pendingOnboardingExtraction: result, pendingOnboardingExtractionIsSimulation: isSimulation }),
  financialExpenseCategories: [],
  financialIncomeCategories: [],
  taskTags: [],
  calendarEventTypes: [],
  addFinancialExpenseCategory: (label) => set((s) => addCategorySuggestion(s, 'financialExpenseCategories', label)),
  addFinancialIncomeCategory: (label) => set((s) => addCategorySuggestion(s, 'financialIncomeCategories', label)),
  addCalendarEventType: (label) => set((s) => addCategorySuggestion(s, 'calendarEventTypes', label)),
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

  atendimentos: [],
  addAtendimento: (atendimento) => {
    let id: string | null = null;
    set((s) => {
      const client = atendimento.clientId ? s.clienteItems.find((item) => item.id === atendimento.clientId) : undefined;
      const quote = atendimento.quoteId ? s.orcamentos.find((item) => item.id === atendimento.quoteId) : undefined;
      if ((atendimento.clientId && !client) || (quote && (quote.status !== 'aprovado' || (client && quote.clientId !== client.id))) || (atendimento.quoteId && !quote)) return s;
      id = generateId('apt_');
      const calendarEventId = `appointment:${id}`;
      const description = `${atendimento.service}${client ? ` · ${client.name}` : ''}`;
      return {
        atendimentos: [{ ...atendimento, id, calendarEventId }, ...s.atendimentos],
        events: [...s.events, { id: calendarEventId, date: atendimento.date, time: atendimento.time, description, done: false, type: 'event' as const }],
      };
    });
    return id;
  },
  updateAtendimento: (id, updates) => {
    let updated = false;
    set((s) => {
      const current = s.atendimentos.find((item) => item.id === id);
      if (!current) return s;
      const next = { ...current, ...updates, id };
      if (next.quoteId) {
        const quote = s.orcamentos.find((item) => item.id === next.quoteId);
        if (!quote || quote.status !== 'aprovado' || (next.clientId && quote.clientId !== next.clientId)) return s;
      }
      updated = true;
      const client = next.clientId ? s.clienteItems.find((item) => item.id === next.clientId) : undefined;
      return {
        atendimentos: s.atendimentos.map((item) => item.id === id ? next : item),
        events: s.events.map((event) => event.id === next.calendarEventId ? { ...event, date: next.date, time: next.time, description: `${next.service}${client ? ` · ${client.name}` : ''}`, done: next.status !== 'confirmado' } : event),
      };
    });
    return updated;
  },
  concludeAtendimento: (id) => {
    const current = useAppStore.getState().atendimentos.find((item) => item.id === id);
    if (!current || current.status !== 'confirmado') return false;
    if (current.quoteId) {
      const quote = useAppStore.getState().orcamentos.find((item) => item.id === current.quoteId);
      const order = quote?.orderId ? useAppStore.getState().pedidos.find((item) => item.id === quote.orderId) : undefined;
      if (!quote || quote.status !== 'aprovado' || !order) return false;
      if (order.status !== 'concluido' && !useAppStore.getState().completePedido(order.id)) return false;
    }
    let concluded = false;
    set((s) => {
      if (!s.atendimentos.some((item) => item.id === id && item.status === 'confirmado')) return s;
      concluded = true;
      return { atendimentos: s.atendimentos.map((item) => item.id === id ? { ...item, status: 'concluido' as const } : item), events: s.events.map((event) => event.id === current.calendarEventId ? { ...event, done: true } : event) };
    });
    return concluded;
  },
  removeAtendimento: (id) => set((s) => {
    const appointment = s.atendimentos.find((item) => item.id === id);
    if (!appointment) return s;
    return { atendimentos: s.atendimentos.filter((item) => item.id !== id), events: s.events.filter((event) => event.id !== appointment.calendarEventId) };
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
      const appointmentEventIds = new Set(s.atendimentos.filter((atendimento) => atendimento.clientId === id).map((atendimento) => atendimento.calendarEventId));
      return {
        clienteItems: s.clienteItems.filter((i) => i.id !== id),
        transactions: s.transactions.filter((transaction) => !contractIds.has(transaction.contractId ?? '')).map((transaction) => transaction.clientId === id ? { ...transaction, clientId: undefined } : transaction),
        events: s.events.filter((event) => !appointmentEventIds.has(event.id) && ![...contractIds].some((contractId) => event.id.startsWith(`contract-due:${contractId}:`))),
        contratos: s.contratos.filter((contrato) => !contractIds.has(contrato.id)),
        atendimentos: s.atendimentos.filter((atendimento) => atendimento.clientId !== id),
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
       taxonomy: result.taxonomy ?? migrateV1toV2({ ...result, coreCategories: { financial: { expense: result.coreCategories.financial.expense.map((c) => c.label), income: result.coreCategories.financial.income.map((c) => c.label) }, taskTags: result.coreCategories.taskTags.map((c) => c.label), calendarEventTypes: result.coreCategories.calendarEventTypes.map((c) => c.label) } }),
      pendingOnboardingExtraction: null,
      pendingOnboardingExtractionIsSimulation: false,
      businessName: result.businessName ?? s.businessName,
      financialExpenseCategories: result.coreCategories.financial.expense,
      financialIncomeCategories: result.coreCategories.financial.income,
      taskTags: result.coreCategories.taskTags,
      calendarEventTypes: result.coreCategories.calendarEventTypes,
      keywordMap: result.keywordMap,
      recommendedPlugins: result.recommendedPlugins,
      customTaskTags: result.coreCategories.taskTags.map((c) => c.label),
      onboardingCompleted: true,
    })),
  hydrateOnboarding: ({ responses, context, structuredProfile, activatedPlugins }) =>
    set((s) => structuredProfile ? {
      openAnswers: responses,
      onboardingContext: context,
       onboardingExtraction: structuredProfile,
       taxonomy: structuredProfile.taxonomy ?? migrateV1toV2({ ...structuredProfile, coreCategories: { financial: { expense: structuredProfile.coreCategories.financial.expense.map((c) => c.label), income: structuredProfile.coreCategories.financial.income.map((c) => c.label) }, taskTags: structuredProfile.coreCategories.taskTags.map((c) => c.label), calendarEventTypes: structuredProfile.coreCategories.calendarEventTypes.map((c) => c.label) } }),
      pendingOnboardingExtraction: null,
      pendingOnboardingExtractionIsSimulation: false,
      businessName: structuredProfile.businessName ?? s.businessName,
      businessType: structuredProfile.segment ?? s.businessType,
      financialExpenseCategories: structuredProfile.coreCategories.financial.expense,
      financialIncomeCategories: structuredProfile.coreCategories.financial.income,
      taskTags: structuredProfile.coreCategories.taskTags,
      calendarEventTypes: structuredProfile.coreCategories.calendarEventTypes,
      keywordMap: structuredProfile.keywordMap,
      recommendedPlugins: structuredProfile.recommendedPlugins,
      customTaskTags: structuredProfile.coreCategories.taskTags.map((c) => c.label),
      activatedPlugins,
      onboardingCompleted: true,
    } : {
      openAnswers: responses,
      onboardingContext: context,
      activatedPlugins,
      onboardingCompleted: true,
       onboardingExtraction: null,
       taxonomy: null,
      pendingOnboardingExtraction: null,
      pendingOnboardingExtractionIsSimulation: false,
      financialExpenseCategories: [],
      financialIncomeCategories: [],
      taskTags: [],
      calendarEventTypes: [],
      keywordMap: {},
      recommendedPlugins: [],
      customTaskTags: [],
    }),

  resetOnboardingState: () =>
    set({
      onboardingCompleted: false,
      businessName: '',
      businessType: '',
      openAnswers: {},
      onboardingContext: null,
      onboardingExtraction: null,
      taxonomy: null,
      pendingOnboardingExtraction: null,
      pendingOnboardingExtractionIsSimulation: false,
      financialExpenseCategories: [],
      financialIncomeCategories: [],
      taskTags: [],
      calendarEventTypes: [],
      keywordMap: {},
      recommendedPlugins: [],
      customTaskTags: [],
      activatedPlugins: [],
      dismissedPluginSuggestions: [],
    }),

  transactions: [],
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

  tasks: [] as Task[],
  addTask: (t) => {
    const id = generateId('task_');
    set((s) => ({
      tasks: [{ ...t, id } as Task, ...s.tasks],
    }));
    return id;
  },
  updateTask: (id, updates) => {
    set((s) => {
      const task = s.tasks.find((tt) => tt.id === id);
      if (!task) return s;
      const next = { ...task, ...updates, id } as Task;
      // Sincronização tarefa → calendário (seção 9/10): quando `dueDate` ou
      // `description` mudem, o evento derivado (source='task') acompanha,
      // para evitar dessincronia (Task 22/08 / Calendar 20/08). Eventos
      // independentes (source='manual'|'chat') NÃO são sobrescritos.
      let events = s.events;
      if (next.calendarEventId) {
        events = s.events.map((e) => {
          if (e.id !== next.calendarEventId) return e;
          if (e.source !== 'task') return e; // só derivados acompanhval
          const patches: Partial<CalendarEvent> = {};
          if (updates.dueDate !== undefined) {
            patches.date = updates.dueDate ?? e.date;
          }
          if (updates.description !== undefined) {
            patches.description = updates.description;
          }
          if (updates.done !== undefined) {
            patches.done = updates.done;
          }
          if (Object.keys(patches).length === 0) return e;
          return { ...e, ...patches } as CalendarEvent;
        });
      }
      // Sincronização `done` TAMBÉM é tratada em `toggleTask`; aqui cobre o
      // caso raro de vir via `updateTask({ done })`.
      return { tasks: s.tasks.map((tt) => (tt.id === id ? next : tt)), events };
    });
  },
  toggleTask: (id) =>
    set((s) => {
      const task = s.tasks.find((t) => t.id === id);
      if (!task) return s;
      const newDone = !task.done;
      const tasks = s.tasks.map((t) => (t.id === id ? { ...t, done: newDone } as Task : t));
      // Sincronização conclusão (seções 7/8): evento derivado vai junto -
      // permanece visível, marcado concluído (NÃO apagado).
      let events = s.events;
      if (task.calendarEventId) {
        events = s.events.map((e) => (e.id === task.calendarEventId ? { ...e, done: newDone } : e));
      }
      return { tasks, events };
    }),
  removeTask: (id) =>
    set((s) => {
      const task = s.tasks.find((t) => t.id === id);
      if (!task) return s;
      // Sincronização exclusão (seção 11): se há evento derivado
      // (source='task') exclusivamente como representação, removê-lo para
      // não deixar órfão. Eventos independentes são preservados.
      let events = s.events;
      if (task.calendarEventId) {
        const linked = s.events.find((e) => e.id === task.calendarEventId);
        if (linked && linked.source === 'task') {
          events = s.events.filter((e) => e.id !== task.calendarEventId);
        }
      }
      return {
        tasks: s.tasks.filter((t) => t.id !== id),
        events,
        // Tarefa removida NÃO apaga o lançamento financeiro vinculado —
        // apenas desvincula (o registro financeiro é permanente).
        transactions: s.transactions.map((t) => (t.taskId === id ? { ...t, taskId: undefined } : t)),
      };
    }),
  calendarizeTask: (taskId, opts) => {
    let ok = false;
    set((s) => {
      const task = s.tasks.find((t) => t.id === taskId);
      if (!task) return s;
      // Idempotência (seção 15): se já está vinculado ou já existe um
      // evento derivado desta tarefa, NÃO cria duplicata.
      if (task.calendarEventId) return s;
      if (s.events.some((e) => e.taskId === taskId)) return s;
      ok = true;
      const calendarEventId = generateId('cal_task_');
      const event: CalendarEvent = {
        id: calendarEventId,
        date: opts.date,
        time: opts.time ?? null,
        description: task.description,
        done: task.done,
        type: 'task',
        eventType: opts.eventType,
        taskId,
        source: 'task',
        origin: task.source === 'chat' ? 'chat' : undefined,
        deadline: opts.deadline ? true : undefined,
      };
      return {
        events: [...s.events, event],
        tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, calendarEventId } : t)),
      };
    });
    return ok;
  },

  linkTaskToTransaction: (taskId, transactionId) =>
    set((s) => {
      if (!s.tasks.some((t) => t.id === taskId) || !s.transactions.some((t) => t.id === transactionId)) return s;
      return {
        tasks: s.tasks.map((t) => (t.id === taskId && t.financeTransactionId !== transactionId ? { ...t, financeTransactionId: transactionId } : t)),
        transactions: s.transactions.map((t) => (t.id === transactionId && t.taskId !== taskId ? { ...t, taskId } : t)),
      };
    }),

  customTaskTags: [],
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

  events: [],
  addEvent: (e) =>
    set((s) => ({
      events: [...s.events, { ...e, done: e.done ?? false, id: generateId('cal_') }],
    })),
  toggleEvent: (id) =>
    set((s) => {
      const event = s.events.find((e) => e.id === id);
      if (!event) return s;
      const newDone = !event.done;
      const events = s.events.map((e) => (e.id === id ? { ...e, done: newDone } : e));
      // Sincronização reversa conclusão (seções 7/8): concluir o evento
      // derivado conclui a tarefa vinculada (snapshot, evita órfão visual).
      let tasks = s.tasks;
      if (event.source === 'task' && event.taskId) {
        const task = s.tasks.find((t) => t.id === event.taskId);
        if (task && task.done !== newDone) {
          tasks = s.tasks.map((t) => (t.id === event.taskId ? { ...t, done: newDone } as Task : t));
        }
      }
      return { events, tasks };
    }),
  removeEvent: (id) =>
    set((s) => {
      const event = s.events.find((e) => e.id === id);
      if (!event) return s;
      // Sincronização exclusão (seção 11): remover um evento derivado
      // (source='task') desvincula a tarefa (limpa `calendarEventId`),
      // preservando a tarefa — o usuário explicitamente apagou só a
      // aparência de calendário. Eventos independentes apenas somem.
      let tasks = s.tasks;
      if (event.source === 'task' && event.taskId) {
        tasks = s.tasks.map((t) => (t.id === event.taskId ? { ...t, calendarEventId: undefined } as Task : t));
      }
      return {
        events: s.events.filter((e) => e.id !== id),
        tasks,
      };
    }),
  updateEvent: (id, updates) =>
    set((s) => {
      const event = s.events.find((e) => e.id === id);
      if (!event) return s;
      const next = { ...event, ...updates, id } as CalendarEvent;
      // Sincronização reversa (seções 8/9): propagar `done` e `date`
      // Ao tarefa vinculada, evitando dessincronia.
      let tasks = s.tasks;
      if (event.source === 'task' && event.taskId) {
        const task = s.tasks.find((t) => t.id === event.taskId);
        if (task) {
          const patches: Partial<Task> = {};
          if (updates.done !== undefined) patches.done = updates.done;
          if (updates.date !== undefined) patches.dueDate = updates.date;
          if (Object.keys(patches).length > 0) {
            tasks = s.tasks.map((t) => (t.id === event.taskId ? { ...t, ...patches } as Task : t));
          }
        }
      }
      return {
        events: s.events.map((e) => (e.id === id ? next : e)),
        tasks,
      };
    }),

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
