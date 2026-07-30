import { onboardingRepository, OnboardingRecord } from '../repositories/onboardingRepository';
import { userService } from './userService';
import { PublicUser } from '../types/user';

/**
 * Persistência das respostas do onboarding.
 *
 * Não há nenhum processamento por IA aqui — apenas guarda exatamente o que
 * foi coletado nas telas de onboarding (ver `app/onboarding.tsx` e
 * `src/ai/onboardingContext.ts`), associado ao usuário logado.
 *
 * `saveStructuredProfile` já existe como preparação para o futuro (ver
 * `src/ai/types.ts` -> `ExtractedBusinessProfile`), mas não é chamado por
 * nenhuma tela ainda.
 */
export const onboardingService = {
  async getResponses(userId: string): Promise<OnboardingRecord | null> {
    return onboardingRepository.get(userId);
  },

  /**
   * Salva as respostas brutas do onboarding e marca `onboardingCompleted`
   * como concluído no usuário. `context` é opcional — hoje é o DTO gerado
   * por `buildOnboardingContextDTO()`.
   */
  async completeOnboarding(
    userId: string,
    responses: unknown,
    context?: unknown
  ): Promise<{ record: OnboardingRecord; user: PublicUser }> {
    const record = await onboardingRepository.save(userId, { responses, context });
    const user = await userService.markOnboardingCompleted(userId, true);
    return { record, user };
  },

  /**
   * Reservado para a etapa futura: uma IA lê `responses`/`context` e
   * devolve um JSON estruturado (`ExtractedBusinessProfile`), que é salvo
   * aqui SEM apagar as respostas originais.
   */
  async saveStructuredProfile(userId: string, structuredProfile: unknown): Promise<OnboardingRecord> {
    return onboardingRepository.save(userId, { structuredProfile });
  },
};
