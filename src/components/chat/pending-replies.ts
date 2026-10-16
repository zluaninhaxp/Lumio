import type { ChatHistoryMessage } from '../../types/chat';

export type PendingChatReply = { requestId: string; responseId?: string };

export function trackPendingReply(
  replies: PendingChatReply[], requestId: string, responseId?: string,
): PendingChatReply[] {
  const existing = replies.find(reply => reply.requestId === requestId);
  if (!existing) return [...replies, { requestId, responseId }];
  if (!responseId || existing.responseId === responseId) return replies;
  return replies.map(reply => reply === existing ? { ...reply, responseId } : reply);
}

/** Persistence may still be finishing after acknowledgement exposed the reply.
 * Only local requests without their visible response can own the typing footer.
 * Loading/syncing history never creates requests. */
export function unansweredReplies(replies: PendingChatReply[], history: ChatHistoryMessage[]): PendingChatReply[] {
  if (!replies.length) return replies;
  const visibleResponses = new Set(history.filter(message => message.type !== 'user' && !message.pending).map(message => message.id));
  const remaining = replies.filter(reply => !reply.responseId || !visibleResponses.has(reply.responseId));
  return remaining.length === replies.length ? replies : remaining;
}
