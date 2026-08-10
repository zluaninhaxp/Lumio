import { create } from 'zustand';
import { mockTransactions, mockTasks, mockCalendarEvents } from '../data/mock';
import {
  guessBusinessTypeFallback,
  guessBusinessNameFallback,
} from '../engine/openOnboardingEngine';
import { buildOnboardingContextDTO, OnboardingContextDTO } from '../ai/onboardingContext';
import { OnboardingExtractionResult, CategorySuggestion, RecommendedPlugin } from '../ai/types';
import { PluginId } from '../plugins/registry';

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
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
  pending: string;
  lastInteraction: string;
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

  clienteItems: ClienteItem[];
  addClienteItem: (item: Omit<ClienteItem, 'id'>) => void;
  updateClienteItem: (id: string, item: Omit<ClienteItem, 'id'>) => void;
  removeClienteItem: (id: string) => void;

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
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
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
    set((s) => ({
      activatedPlugins: activated
        ? [...new Set([...s.activatedPlugins, pluginId])]
        : s.activatedPlugins.filter((id) => id !== pluginId),
    })),

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

  clienteItems: [],
  addClienteItem: (item) =>
    set((s) => ({
      clienteItems: [{ ...item, id: Date.now().toString() }, ...s.clienteItems],
    })),
  updateClienteItem: (id, item) =>
    set((s) => ({
      clienteItems: s.clienteItems.map((i) => (i.id === id ? { ...item, id } : i)),
    })),
  removeClienteItem: (id) =>
    set((s) => ({ clienteItems: s.clienteItems.filter((i) => i.id !== id) })),

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
  addTransaction: (t) =>
    set((s) => ({
      transactions: [{ ...t, id: Date.now().toString() }, ...s.transactions],
    })),
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
