import { create } from 'zustand';
import { mockTransactions, mockTasks, mockCalendarEvents } from '../data/mock';

type Transaction = typeof mockTransactions[0];
type Task = typeof mockTasks[0];
type CalendarEvent = typeof mockCalendarEvents[0];

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  text: string;
  actions?: Array<{ label: string; onPress?: () => void }>;
  timestamp: Date;
}

interface AppStore {
  // Transactions
  transactions: Transaction[];
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  removeTransaction: (id: string) => void;

  // Tasks
  tasks: Task[];
  addTask: (t: Omit<Task, 'id'>) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;

  // Calendar
  events: CalendarEvent[];
  addEvent: (e: Omit<CalendarEvent, 'id'>) => void;
  toggleEvent: (id: string) => void;

  // Chat
  messages: ChatMessage[];
  addMessage: (m: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
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
