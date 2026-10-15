/** Only explicit invalidation is a signed-out state; network/rate/server failures are recoverable. */
export function isInvalidSession(error: { code?: string; status?: number; name?: string } | null | undefined) {
  return !!error && (['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'user_not_found', 'bad_jwt'].includes(error.code ?? '')
    || (error.status === 401 && error.name !== 'AuthRetryableFetchError'));
}
