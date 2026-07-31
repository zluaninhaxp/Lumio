import { create } from 'zustand';
import { mockTransactions, mockTasks, mockCalendarEvents } from '../data/mock';
import {
  guessBusinessTypeFallback,
  guessBusinessNameFallback,
} from '../engine/openOnboardingEngine';
import { buildOnboardingContextDTO, OnboardingContextDTO } from '../ai/onboardingContext';
import { OnboardingExtractionResult, CategorySuggestion, RecommendedPlugin } from '../ai/types';

type Transaction = (typeof mockTransactions)[0];
type Task = (typeof mockTasks)[0];
type CalendarEvent = (typeof mockCalendarEvents)[0];

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

  /** Categorias/tags aplicadas aos 3 módulos existentes, com origin preservado. */
  financialExpenseCategories: CategorySuggestion[];
  financialIncomeCategories: CategorySuggestion[];
  taskTags: CategorySuggestion[];
  calendarEventTypes: CategorySuggestion[];
  /** Palavra/expressão -> nome de categoria, para auto-classificação futura. */
  keywordMap: Record<string, string>;

  recommendedPlugins: RecommendedPlugin[];
  /** Escolha do usuário na tela de resumo: 'Ativar agora' ou 'Talvez depois'. */
  activatedPlugins: string[];
  setPluginActivation: (pluginId: string, activated: boolean) => void;

  /**
   * Aplica o resultado da extração (mock hoje, IA real no futuro) aos 3
   * módulos existentes e marca o onboarding como concluído.
   */
  applyOnboardingExtraction: (result: OnboardingExtractionResult) => void;

  transactions: Transaction[];
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  removeTransaction: (id: string) => void;

  tasks: Task[];
  addTask: (t: Omit<Task, 'id'>) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;

  events: CalendarEvent[];
  addEvent: (e: Omit<CalendarEvent, 'id'>) => void;
  toggleEvent: (id: string) => void;

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

  applyOnboardingExtraction: (result) =>
    set((s) => ({
      onboardingExtraction: result,
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

  tasks: mockTasks,
  addTask: (t) =>
    set((s) => ({
      tasks: [{ ...t, id: Date.now().toString() }, ...s.tasks],
    })),
  toggleTask: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    })),
  removeTask: (id) =>
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  events: mockCalendarEvents,
  addEvent: (e) =>
    set((s) => ({
      events: [...s.events, { ...e, id: Date.now().toString() }],
    })),
  toggleEvent: (id) =>
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, done: !e.done } : e)),
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
