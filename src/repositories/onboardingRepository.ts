import { storageService } from '../services/storageService';
import { StorageKeys } from '../constants/storageKeys';

/**
 * Formato do registro de onboarding de um usuário.
 *
 * `responses` é INTENCIONALMENTE `unknown` / livre de forma: cada etapa do
 * onboarding hoje produz um `Record<string, string>` (ver
 * `openOnboardingEngine.ts`), mas isso pode mudar (listas, objetos
 * aninhados, etc.). Esta camada só precisa guardar e devolver o que foi
 * passado, sem impor um schema.
 *
 * `structuredProfile` é o espaço reservado para o JSON que uma IA vai
 * gerar no futuro a partir de `responses`/`context` (ver `src/ai/types.ts`
 * -> `OnboardingExtractionResult`). Ele nunca substitui `responses` — apenas
 * se soma como mais uma camada de dados do usuário.
 */
export interface OnboardingRecord {
  userId: string;
  /** Respostas brutas, exatamente como o usuário forneceu. */
  responses: unknown;
  /** Snapshot opcional de contexto (perguntas + respostas + heurísticas locais). */
  context?: unknown;
  /** Reservado para a futura extração via IA. Não preenchido nesta etapa. */
  structuredProfile?: unknown;
  updatedAt: string;
}

function keyFor(userId: string): string {
  return `${StorageKeys.ONBOARDING_PREFIX}${userId}`;
}

export const onboardingRepository = {
  async get(userId: string): Promise<OnboardingRecord | null> {
    return storageService.getItem<OnboardingRecord>(keyFor(userId));
  },

  async save(userId: string, partial: Partial<Omit<OnboardingRecord, 'userId'>>): Promise<OnboardingRecord> {
    const existing = await this.get(userId);
    const record: OnboardingRecord = {
      userId,
      responses: existing?.responses ?? {},
      context: existing?.context,
      structuredProfile: existing?.structuredProfile,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    await storageService.setItem(keyFor(userId), record);
    return record;
  },

  async clear(userId: string): Promise<void> {
    await storageService.removeItem(keyFor(userId));
  },
};
