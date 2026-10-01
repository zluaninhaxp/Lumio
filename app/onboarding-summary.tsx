import { useEffect, useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../src/constants/theme';
import { useAppStore } from '../src/store';
import { useAuth } from '../src/hooks/useAuth';
import { onboardingService } from '../src/services/onboardingService';
import { CategorySuggestion } from '../src/ai/types';
import type { OnboardingExtractionResult } from '../src/ai/types';
import { getPluginDefinition } from '../src/plugins/registry';
import ReportResultOverview, { ReportSection } from './components/onboarding/report-result-overview';
import ReportDetail from './components/onboarding/report-detail';

/**
 * Nomes amigáveis para os plugins recomendados — vêm do catálogo fechado em
 * `src/plugins/registry.ts` (fonte única de verdade sobre os 11 plugins
 * existentes). Qualquer id fora do catálogo cai no fallback, que só
 * capitaliza o próprio id.
 */
function friendlyPluginName(pluginId: string | null | undefined): string {
  if (!pluginId) return 'Plugin sugerido';
  return getPluginDefinition(pluginId)?.label
    ?? pluginId.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Grupo visual de categorias/tags geradas pelo onboarding. Cada item mostra
 * um indicador discreto (ponto colorido) de origem: citada pelo usuário
 * (`mentioned`) vs. sugerida com base no segmento (`suggested`) — ver
 * `CategorySuggestion` em `src/ai/types.ts`.
 */
function CategoryGroup({
  title, items, icon,
}: {
  title: string;
  items: CategorySuggestion[];
  icon: keyof typeof Ionicons.glyphMap;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.categoryGroup}>
      <View style={styles.categoryGroupHeader}>
        <Ionicons name={icon} size={16} color={Colors.textSecondary} />
        <Text style={styles.categoryGroupTitle}>{title}</Text>
      </View>
      <View style={styles.categoryChips}>
        {items.map((item) => (
          <View key={item.label} style={styles.categoryChip}>
            <View
              style={[
                styles.categoryDot,
                item.origin === 'suggested' && styles.categoryDotSuggested,
              ]}
            />
            <Text style={styles.categoryChipText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function OnboardingSummaryScreen() {
  const router = useRouter();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const [detailsSection, setDetailsSection] = useState<ReportSection | 'full' | null>(() => view === 'full' ? 'full' : null);
  useEffect(() => {
    if (view === 'full') setDetailsSection('full');
  }, [view]);
  const insets = useSafeAreaInsets();
  const { currentUser, refreshUser } = useAuth();

  const extraction = useAppStore((s) => s.pendingOnboardingExtraction);
  const isSimulation = useAppStore((s) => s.pendingOnboardingExtractionIsSimulation);
  const openAnswers = useAppStore((s) => s.openAnswers);
  const onboardingContext = useAppStore((s) => s.onboardingContext);
  const applyOnboardingExtraction = useAppStore((s) => s.applyOnboardingExtraction);
  const activatedPlugins = useAppStore((s) => s.activatedPlugins);
  const setPluginActivation = useAppStore((s) => s.setPluginActivation);
  const setPendingOnboardingExtraction = useAppStore((s) => s.setPendingOnboardingExtraction);

  // Se a pessoa cair aqui sem ter passado pela celebração (ex: deep link,
  // refresh), não há o que resumir — volta pro início do onboarding. MAS
  // enquanto finalizamos (ver `handleFinish` abaixo) o store zera
  // `pendingOnboardingExtraction` e esse efeito dispararia de novo em
  // direto ao `/onboarding`, competindo com o redirect pro chat — daí o
  // flash da tela de onboarding antes do chat. O `finishingRef` bloqueia
  // o redirect errático durante a finalização.
  const finishingRef = useRef(false);
  useEffect(() => {
    if (!extraction && !finishingRef.current) {
      router.replace('/onboarding');
    }
  }, [extraction, router]);

  const handleFinish = useCallback(async () => {
    if (!extraction || finishingRef.current) return;
    finishingRef.current = true;
    applyOnboardingExtraction(extraction);

    if (currentUser) {
      try {
        await onboardingService.completeOnboarding(
          currentUser.id,
          openAnswers,
          onboardingContext ?? undefined,
          extraction,
          activatedPlugins
        );
        await refreshUser();
      } catch (error) {
        // Não bloqueia o fluxo do usuário por um erro de persistência local —
        // ele já viu o resumo na tela; apenas registramos o problema.
        console.warn('Falha ao salvar respostas do onboarding:', error);
      }
    }

    router.replace('/(tabs)/chat');
  }, [applyOnboardingExtraction, currentUser, extraction, onboardingContext, openAnswers, activatedPlugins, refreshUser, router]);

  if (!extraction) return null;

  if (!detailsSection) return <ReportResultOverview extraction={extraction} isSimulation={isSimulation} onViewFull={() => router.push('/onboarding-report-intro')} onViewSection={setDetailsSection} onEditAnswers={() => router.replace('/onboarding')} />;

  if (detailsSection === 'full') return <ReportDetail
    extraction={extraction}
    isSimulation={isSimulation}
    activatedPlugins={activatedPlugins}
    onBack={() => router.replace('/onboarding-report-intro')}
    onFinish={handleFinish}
    onSave={async (next: OnboardingExtractionResult) => {
      if (!currentUser) throw new Error('Usuário não disponível');
      await onboardingService.saveStructuredProfile(currentUser.id, next);
      setPendingOnboardingExtraction(next, isSimulation);
    }}
    onPluginActivation={setPluginActivation}
    onConfigureAi={() => router.push('/ai-settings')}
  />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.xl,
          paddingBottom: Spacing.xxl + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.detailsBack} onPress={() => setDetailsSection(null)} accessibilityRole="button"><Ionicons name="chevron-back" size={22} color={Colors.accent} /><Text style={styles.detailsBackText}>Voltar ao resumo</Text></TouchableOpacity>
        <Text style={styles.detailsHeading}>{detailsSection === 'categories' ? 'Categorias identificadas' : detailsSection === 'tags' ? 'Tags de tarefa' : detailsSection === 'calendar' ? 'Tipos de evento' : 'Sugestões para o negócio'}</Text>

        {isSimulation && (
          <View style={styles.simBanner}>
            <Ionicons name="flash-outline" size={20} color={Colors.warning} />
            <View style={styles.simBannerText}>
              <Text style={styles.simBannerTitle}>Relatório simulado</Text>
              <Text style={styles.simBannerDesc}>
                Sem uma chave de IA configurada, este relatório veio de uma
                estimativa local. Configure sua chave grátis do Google AI
                Studio para gerar a versão completa com IA.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.simBannerBtn}
              onPress={() => router.push('/ai-settings')}
              activeOpacity={0.8}
            >
              <Text style={styles.simBannerBtnText}>Configurar</Text>
            </TouchableOpacity>
          </View>
        )}

        {detailsSection === 'categories' && <>
          <CategoryGroup title="Categorias de despesa (Financeiro)" items={extraction.coreCategories.financial.expense} icon="arrow-down-circle" />
          <CategoryGroup title="Categorias de receita (Financeiro)" items={extraction.coreCategories.financial.income} icon="arrow-up-circle" />
        </>}
        {detailsSection === 'tags' && <CategoryGroup title="Tags de tarefa" items={extraction.coreCategories.taskTags} icon="checkbox-outline" />}
        {detailsSection === 'calendar' && <CategoryGroup title="Tipos de evento (Calendário)" items={extraction.coreCategories.calendarEventTypes} icon="calendar-outline" />}

        {detailsSection === 'plugins' && extraction.recommendedPlugins.length > 0 && (
          <View style={styles.pluginSection}>
            <Text style={styles.pluginSectionTitle}>Sugestões pra você</Text>
            {extraction.recommendedPlugins.map((p) => {
              const isActivated = activatedPlugins.includes(p.plugin);
              const def = getPluginDefinition(p.plugin);
              return (
                <View key={p.plugin} style={styles.pluginCard}>
                  <Text style={styles.pluginName}>{friendlyPluginName(p.plugin)}</Text>
                  {def ? (
                    <Text style={styles.pluginDescription}>{def.description}</Text>
                  ) : null}
                  {p.reason ? (
                    <Text style={styles.pluginReason}>Por que pra você: {p.reason}</Text>
                  ) : null}
                  <View style={styles.pluginActions}>
                    <TouchableOpacity
                      style={[styles.pluginBtn, isActivated && styles.pluginBtnActive]}
                      onPress={() => setPluginActivation(p.plugin, true)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.pluginBtnText, isActivated && styles.pluginBtnTextActive]}>
                        {isActivated ? 'Ativado' : 'Ativar agora'}
                      </Text>
                    </TouchableOpacity>
                    {!isActivated && (
                      <TouchableOpacity
                        style={styles.pluginBtnGhost}
                        onPress={() => setPluginActivation(p.plugin, false)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.pluginBtnGhostText}>Talvez depois</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={styles.fullLink} onPress={() => router.push('/onboarding-report-intro')} accessibilityRole="button"><Text style={styles.fullLinkText}>Ver relatório completo</Text><Ionicons name="arrow-forward" size={17} color={Colors.accent} /></TouchableOpacity>

        <TouchableOpacity
          style={styles.finishBtn}
          onPress={handleFinish}
          activeOpacity={0.85}
        >
          <Text style={styles.finishBtnText}>Confirmar e continuar</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  detailsBack: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  detailsBackText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.accent },
  detailsHeading: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.xxl, color: Colors.primary, marginBottom: Spacing.xl },
  fullLink: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.md },
  fullLinkText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.accent },
  simBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: '#FFF7E6',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#F5C56B',
  },
  simBannerText: { flex: 1 },
  simBannerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.sm,
    color: '#9A6B00',
    marginBottom: 2,
  },
  simBannerDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.xs,
    color: '#7A5400',
    lineHeight: 18,
  },
  simBannerBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  simBannerBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.xs,
    color: '#FFFFFF',
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
  },
  finishBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md,
    color: '#FFFFFF',
  },

  // Category groups (financeiro/tarefas/calendário)
  categoryGroup: { marginBottom: Spacing.lg },
  categoryGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  categoryGroupTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent },
  categoryDotSuggested: { backgroundColor: Colors.textMuted },
  categoryChipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.primary,
  },

  // Plugins recomendados
  pluginSection: { marginTop: Spacing.sm, marginBottom: Spacing.lg },
  pluginSectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.lg,
    color: Colors.primary,
    marginBottom: Spacing.md,
  },
  pluginCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pluginName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.md,
    color: Colors.primary,
    marginBottom: 4,
  },
  pluginDescription: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  pluginReason: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginBottom: Spacing.md,
  },
  pluginActions: { flexDirection: 'row', gap: Spacing.sm },
  pluginBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  pluginBtnActive: { backgroundColor: Colors.primary },
  pluginBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },
  pluginBtnTextActive: { color: '#FFFFFF' },
  pluginBtnGhost: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  pluginBtnGhostText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
