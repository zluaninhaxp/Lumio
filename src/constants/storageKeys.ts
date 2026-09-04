/**
 * Todas as chaves usadas no AsyncStorage ficam centralizadas aqui.
 * Nenhuma outra parte do app (telas, contexts, hooks) deveria conhecer
 * essas chaves — apenas os repositories.
 */
export const StorageKeys = {
  /** Lista com todos os usuários cadastrados (User[]). */
  USERS: '@lumio/users',
  /** Sessão ativa no momento (Session | null). */
  SESSION: '@lumio/session',
  /** Prefixo — a chave real é `${ONBOARDING_PREFIX}${userId}`. */
  ONBOARDING_PREFIX: '@lumio/onboarding/',
  LEARNED_INTENTS_PREFIX: '@lumio/learned-intents/',
} as const;
