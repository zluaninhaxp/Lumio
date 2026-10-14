import { businessStateService } from './businessStateService';
import { useAppStore } from '../store';
import type { OnboardingContextDTO } from '../ai/onboardingContext';
import type { OnboardingExtractionResult } from '../ai/types';
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
 * `src/ai/types.ts` -> `OnboardingExtractionResult`), mas não é chamado por
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
    context?: unknown,
    structuredProfile?: unknown,
    activatedPlugins: string[] = []
  ): Promise<{ record: OnboardingRecord; user: PublicUser }> {
    if (!businessStateService.isStarted(userId)) throw new Error('Aguarde o carregamento da conta.');
    businessStateService.holdChanges();
    try {
      const state = useAppStore.getState();
      const pendingReport = state.pendingOnboardingExtraction;
      const pendingSimulation = state.pendingOnboardingExtractionIsSimulation;
      state.hydrateOnboarding({ responses: responses as Record<string, string>, context: (context ?? null) as OnboardingContextDTO | null,
        structuredProfile: (structuredProfile ?? state.onboardingExtraction) as OnboardingExtractionResult | null,
        activatedPlugins: activatedPlugins.length ? activatedPlugins : state.activatedPlugins, pluginOrder: state.pluginOrder });
      useAppStore.setState({ pendingOnboardingExtraction: pendingReport, pendingOnboardingExtractionIsSimulation: pendingSimulation });
      useAppStore.setState({ onboardingDraft: null });
      businessStateService.stageOnboarding({ responses, context: context ?? null, structuredProfile: structuredProfile ?? state.onboardingExtraction });
      await businessStateService.commit();
    } finally { businessStateService.releaseChanges(); }
    const record = await onboardingRepository.get(userId);
    const user = await userService.getById(userId);
    if (!record || !user?.onboardingCompleted) throw new Error('A conclusão não foi confirmada. Tente novamente.');
    return { record, user };
  },

  /**
   * Reservado para a etapa futura: uma IA lê `responses`/`context` e
   * devolve um JSON estruturado (`OnboardingExtractionResult`), que é salvo
   * aqui SEM apagar as respostas originais.
   */
  async saveStructuredProfile(userId: string, structuredProfile: unknown): Promise<OnboardingRecord> {
    return onboardingRepository.save(userId, { structuredProfile });
  },

  /** Salva preferências da aba Apps sem substituir os dados do onboarding. */
  async savePluginPreferences(userId: string, activatedPlugins: string[], pluginOrder: string[]): Promise<OnboardingRecord> {
    if (!businessStateService.isStarted(userId)) throw new Error('Aguarde o carregamento da conta.');
    useAppStore.setState({ activatedPlugins: activatedPlugins as import('../plugins/registry').PluginId[], pluginOrder: pluginOrder as import('../plugins/registry').PluginId[] });
    await businessStateService.commit();
    const record = await onboardingRepository.get(userId);
    if (!record) throw new Error('Configuração inicial não encontrada.');
    return record;
  },
};
