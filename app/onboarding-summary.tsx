import { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../src/constants/theme';
import { useAppStore } from '../src/store';
import { useAuth } from '../src/hooks/useAuth';
import { onboardingService } from '../src/services/onboardingService';
import { CategorySuggestion } from '../src/ai/types';
import { getPluginDefinition } from '../src/plugins/registry';
import { MASCOT_IMAGES, INTERACTION_MASCOT } from '../src/data/mascotExpressions';
import Mascot from './components/onboarding/Mascot';

/**
 * Nomes amigáveis para os plugins recomendados — vêm do catálogo fechado em
 * `src/plugins/registry.ts` (fonte única de verdade sobre os 11 plugins
 * existentes). Qualquer id fora do catálogo cai no fallback, que só
 * capitaliza o próprio id.
 */
function friendlyPluginName(pluginId: string): string {
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
  const insets = useSafeAreaInsets();
  const { currentUser, refreshUser } = useAuth();

  const extraction = useAppStore((s) => s.pendingOnboardingExtraction);
  const openAnswers = useAppStore((s) => s.openAnswers);
  const onboardingContext = useAppStore((s) => s.onboardingContext);
  const applyOnboardingExtraction = useAppStore((s) => s.applyOnboardingExtraction);
  const activatedPlugins = useAppStore((s) => s.activatedPlugins);
  const setPluginActivation = useAppStore((s) => s.setPluginActivation);

  // Se a pessoa cair aqui sem ter passado pela celebração (ex: deep link,
  // refresh), não há o que resumir — volta pro início do onboarding.
  useEffect(() => {
    if (!extraction) {
      router.replace('/onboarding');
    }
  }, [extraction, router]);

  const handleFinish = useCallback(async () => {
    if (!extraction) return;
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

  const businessName = extraction.businessName ?? 'Sua empresa';
  const businessType = extraction.segment ?? 'negócio';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.xl,
          paddingBottom: Spacing.xxl + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mascotWrap}>
          <Mascot image={MASCOT_IMAGES[INTERACTION_MASCOT.summary]} size={140} />
        </View>

        <View style={styles.thankYou}>
          <Ionicons name="heart-circle" size={32} color={Colors.accent} />
          <Text style={styles.thankYouTitle}>Obrigado, {businessName}!</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryCardLabel}>O QUE ENTENDEMOS</Text>
          <Text style={styles.summaryText}>{extraction.summary}</Text>
        </View>

        <CategoryGroup title="Categorias de despesa (Financeiro)" items={extraction.coreCategories.financial.expense} icon="arrow-down-circle" />
        <CategoryGroup title="Categorias de receita (Financeiro)" items={extraction.coreCategories.financial.income} icon="arrow-up-circle" />
        <CategoryGroup title="Tags de tarefa" items={extraction.coreCategories.taskTags} icon="checkbox-outline" />
        <CategoryGroup title="Tipos de evento (Calendário)" items={extraction.coreCategories.calendarEventTypes} icon="calendar-outline" />

        {extraction.recommendedPlugins.length > 0 && (
          <View style={styles.pluginSection}>
            <Text style={styles.pluginSectionTitle}>Sugestões pra você</Text>
            {extraction.recommendedPlugins.map((p) => {
              const isActivated = activatedPlugins.includes(p.plugin);
              return (
                <View key={p.plugin} style={styles.pluginCard}>
                  <Text style={styles.pluginName}>{friendlyPluginName(p.plugin)}</Text>
                  <Text style={styles.pluginReason}>{p.reason}</Text>
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
  mascotWrap: { alignItems: 'center', paddingTop: Spacing.lg },
  thankYou: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  thankYouTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.xxl,
    color: Colors.primary,
    textAlign: 'center',
  },

  summaryCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryCardLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  summaryText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    lineHeight: 22,
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
  pluginReason: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
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
