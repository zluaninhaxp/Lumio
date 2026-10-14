import type { BotCard } from '../components/chat/BotMessageCard';
import type { FinancialDirectionAmbiguity } from '../engine/financialEngine';
import type { TaskEventAmbiguity } from '../engine/calendarEngine/domainAmbiguity';
export type ChatAmbiguity = FinancialDirectionAmbiguity | TaskEventAmbiguity;
export type QuickActionValue = ChatAmbiguity['options'][number]['value'] | 'register_expense' | 'register_income' | 'add_task' | 'other' | 'command_add_client' | 'command_add_supplier' | 'command_add_employee' | 'command_add_stock' | 'command_add_catalog' | 'command_create_catalog_for_stock';
export interface ChatHistoryMessage {
  id: string;
  type: 'user' | 'bot' | 'fallback';
  text: string;
  actions?: string[];
  quickActions?: { label: string; value: QuickActionValue }[];
  ambiguity?: ChatAmbiguity;
  fallbackSourceText?: string;
  cards?: BotCard[];
  timestamp: Date;
  /** Historical choices are display-only. Restoring a conversation never replays commands. */
  historical?: boolean;
  /** Recovered, not acknowledged; never executable. */
  pending?: boolean;
}
