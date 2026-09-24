/**
 * Chaves legadas lidas somente durante a migração autenticada.
 */
export const StorageKeys = {
  /** Lista antiga de usuários locais; removida após migração. */
  USERS: '@lumio/users',
  /** Sessão fictícia antiga; removida após migração. */
  SESSION: '@lumio/session',
  /** Prefixo — a chave real é `${ONBOARDING_PREFIX}${userId}`. */
  ONBOARDING_PREFIX: '@lumio/onboarding/',
  LEARNED_INTENTS_PREFIX: '@lumio/learned-intents/',
} as const;
