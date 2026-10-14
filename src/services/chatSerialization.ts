import type { ChatHistoryMessage } from '../types/chat';
const redact = (text: string) => text
  .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]+)\b/g, '[credencial removida]')
  .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token removido]')
  .replace(/Bearer\s+[A-Za-z0-9_.-]+/gi, 'Bearer [removido]')
  .replace(/((?:senha|password|api[_ -]?key|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*)\S+/gi, '$1[removido]');

/** Allowlisted UI data only; functions, provider config and credentials never enter the history. */
export function serializeChatMessage(message: ChatHistoryMessage): Record<string, unknown> {
  const cardKeys = ['kind', 'title', 'date', 'dateLabel', 'time', 'assignee', 'tags', 'eventType', 'context', 'direction', 'amount', 'pending', 'category', 'counterparty', 'badgeLabel', 'badgeIcon'];
  const clean = (v: unknown): unknown => typeof v === 'string' ? redact(v) : Array.isArray(v) ? v.map(clean) : v;
  return {
    id: message.id, type: message.type, text: redact(message.text), timestamp: message.timestamp.toISOString(),
    ...(message.cards ? { cards: message.cards.map(card => Object.fromEntries(Object.entries(card).filter(([k]) => cardKeys.includes(k)).map(([k, v]) => [k, clean(v)]))) } : {}),
    ...(message.actions ? { actions: message.actions.map(redact) } : {}),
    ...(message.quickActions ? { quickActions: message.quickActions.map(a => ({ label: redact(a.label), value: a.value })) } : {}),
    // Ambiguities are transient commands. Their executable state is deliberately not restored.
  };
}
export function deserializeChatMessage(payload: Record<string, unknown>): ChatHistoryMessage {
  if (typeof payload.id !== 'string' || typeof payload.text !== 'string' || !['user', 'bot', 'fallback'].includes(payload.type as string)
    || typeof payload.timestamp !== 'string' || !Number.isFinite(Date.parse(payload.timestamp))) throw new Error('Mensagem remota inválida.');
  return { id: payload.id, type: payload.type as ChatHistoryMessage['type'], text: payload.text,
    timestamp: new Date(payload.timestamp), cards: Array.isArray(payload.cards) ? payload.cards as ChatHistoryMessage['cards'] : undefined,
    actions: Array.isArray(payload.actions) ? payload.actions.filter((item): item is string => typeof item === 'string') : undefined,
    quickActions: Array.isArray(payload.quickActions) ? payload.quickActions as ChatHistoryMessage['quickActions'] : undefined,
    historical: true };
}
