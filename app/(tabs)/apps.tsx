import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { useAppStore } from '../../src/store';
import { canActivatePlugin, getPluginDefinition, PluginId } from '../../src/plugins/registry';
import { useAuth } from '../../src/hooks/useAuth';
import { onboardingService } from '../../src/services/onboardingService';
import { UserAvatar } from '../components/account/UserAvatar';
import { AccountSheet } from '../components/account/AccountSheet';

export default function AppsScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [accountVisible, setAccountVisible] = useState(false);
  const {
    activatedPlugins,
    recommendedPlugins,
    dismissedPluginSuggestions,
    setPluginActivation,
    pluginOrder,
    setPluginOrder,
    dismissPluginSuggestion,
  } = useAppStore();

  const tryActivate = (pluginId: PluginId) => {
    const check = canActivatePlugin(pluginId, activatedPlugins);
    if (!check.ok) {
      const labels = check.missing.map((id) => getPluginDefinition(id)?.label ?? id);
      Alert.alert(
        'Dependência necessária',
        `Para ativar ${getPluginDefinition(pluginId)?.label ?? pluginId}, você precisa ter ${labels.join(' e ')} ativados primeiro.`,
        [{ text: 'Entendi' }],
      );
      return;
    }
    setPluginActivation(pluginId, true);
  };

  const orderedPluginIds = useMemo(() => {
    const active = new Set(activatedPlugins);
    return [
      ...pluginOrder.filter((id) => active.has(id)),
      ...activatedPlugins.filter((id) => !pluginOrder.includes(id)),
    ];
  }, [activatedPlugins, pluginOrder]);

  const activeDefs = orderedPluginIds
    .map((id) => getPluginDefinition(id))
    .filter((d): d is NonNullable<typeof d> => !!d);

  const [isOrganizing, setIsOrganizing] = useState(false);

  const movePlugin = async (fromIndex: number, direction: -1 | 1) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= orderedPluginIds.length) return;
    const nextOrder = [...orderedPluginIds];
    [nextOrder[fromIndex], nextOrder[toIndex]] = [nextOrder[toIndex], nextOrder[fromIndex]];
    setPluginOrder(nextOrder);
    if (!currentUser) return;
    try {
      await onboardingService.savePluginPreferences(currentUser.id, activatedPlugins, nextOrder);
    } catch (error) {
      console.warn('Falha ao salvar a ordem dos módulos:', error);
      Alert.alert('Não foi possível salvar', 'A nova ordem ficará disponível nesta sessão. Tente novamente mais tarde.');
    }
  };

  const deactivateAllPlugins = () => {
    Alert.alert(
      'Desativar todos os módulos?',
      'Eles sairão da sua lista de Apps, mas seus dados continuarão guardados para quando você quiser reativá-los.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar todos',
          style: 'destructive',
          onPress: async () => {
            activatedPlugins.forEach((pluginId) => setPluginActivation(pluginId, false));
            setPluginOrder([]);
            setIsOrganizing(false);
            if (!currentUser) return;
            try {
              await onboardingService.savePluginPreferences(currentUser.id, [], []);
            } catch (error) {
              console.warn('Falha ao salvar a desativação dos módulos:', error);
              Alert.alert('Não foi possível salvar', 'Os módulos foram desativados nesta sessão. Tente novamente mais tarde.');
            }
          },
        },
      ],
    );
  };

  const suggestions = recommendedPlugins.filter(
    (p) => !activatedPlugins.includes(p.plugin) && !dismissedPluginSuggestions.includes(p.plugin)
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Apps</Text>
           <UserAvatar user={currentUser} onPress={() => setAccountVisible(true)} />
        </View>

        <Text style={styles.sectionLabel}>
          SEUS MÓDULOS
        </Text>
        {activeDefs.length > 1 && (
          <>
            <TouchableOpacity
              style={styles.organizeButton}
              onPress={() => setIsOrganizing((value) => !value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isOrganizing }}
              accessibilityLabel={isOrganizing ? 'Concluir organização dos módulos' : 'Organizar módulos'}
            >
              <Ionicons name={isOrganizing ? 'checkmark' : 'swap-vertical'} size={16} color={Colors.accent} />
              <Text style={styles.organizeButtonText}>{isOrganizing ? 'Concluir' : 'Organizar'}</Text>
            </TouchableOpacity>
            {isOrganizing && <Text style={styles.organizeHint}>Use as setas para definir a ordem dos módulos.</Text>}
            {isOrganizing && (
              <TouchableOpacity
                style={styles.deactivateAllButton}
                onPress={deactivateAllPlugins}
                accessibilityRole="button"
                accessibilityLabel="Desativar todos os módulos"
              >
                <Ionicons name="remove-circle-outline" size={16} color={Colors.danger} />
                <Text style={styles.deactivateAllText}>Desativar todos</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        {activeDefs.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="apps-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum módulo ativado ainda.</Text>
          </View>
        )}
        {activeDefs.map((def, index) => (
          <TouchableOpacity
            key={def.id}
            style={styles.moduleCard}
            onPress={() => !isOrganizing && router.push(def.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.moduleIcon}>
              <Ionicons name={def.icon as any} size={20} color={Colors.primary} />
            </View>
            <Text style={styles.moduleName}>{def.label}</Text>
            {isOrganizing ? (
              <View style={styles.reorderActions}>
                <TouchableOpacity style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]} onPress={() => movePlugin(index, -1)} disabled={index === 0} accessibilityRole="button" accessibilityLabel={`Mover ${def.label} para cima`}>
                  <Ionicons name="chevron-up" size={20} color={index === 0 ? Colors.textMuted : Colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.reorderButton, index === activeDefs.length - 1 && styles.reorderButtonDisabled]} onPress={() => movePlugin(index, 1)} disabled={index === activeDefs.length - 1} accessibilityRole="button" accessibilityLabel={`Mover ${def.label} para baixo`}>
                  <Ionicons name="chevron-down" size={20} color={index === activeDefs.length - 1 ? Colors.textMuted : Colors.accent} />
                </TouchableOpacity>
              </View>
            ) : <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />}
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.addMoreBtn}
          onPress={() => router.push('/plugins/store' as any)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
          <Text style={styles.addMoreText}>Adicionar mais módulos</Text>
        </TouchableOpacity>

        {suggestions.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>SUGERIDO PRA VOCÊ</Text>
            {suggestions.map((s) => {
              const def = getPluginDefinition(s.plugin);
              if (!def) return null;
              return (
                <View key={s.plugin} style={styles.suggestionCard}>
                  <View style={styles.suggestionIcon}>
                    <Ionicons name={def.icon as any} size={20} color={Colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionName}>{def.label}</Text>
                    <Text style={styles.suggestionReason}>{s.reason}</Text>
                    <View style={styles.suggestionActions}>
                      <TouchableOpacity
                        style={styles.suggestionActivateBtn}
                        onPress={() => tryActivate(def.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.suggestionActivateText}>Ativar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => dismissPluginSuggestion(def.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.suggestionDismissText}>Dispensar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}
       </ScrollView>
       <AccountSheet visible={accountVisible} onClose={() => setAccountVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: FontSize.xxl,
    color: Colors.primary,
  },
  avatar: {
    width: 36, height: 36, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13, color: '#FFFFFF',
  },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  organizeButton: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4,
    minHeight: 44, paddingHorizontal: Spacing.sm, marginBottom: Spacing.xs,
  },
  organizeButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.accent,
  },
  organizeHint: {
    fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.sm,
    color: Colors.textSecondary, marginBottom: Spacing.sm,
  },
  deactivateAllButton: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4,
    minHeight: 44, paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm,
  },
  deactivateAllText: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.sm, color: Colors.danger,
  },
  suggestionCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  suggestionIcon: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  suggestionName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md, color: Colors.primary,
  },
  suggestionReason: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm, color: Colors.textSecondary,
    marginTop: 2,
  },
  suggestionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  suggestionActivateBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
  },
  suggestionActivateText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm, color: '#FFFFFF',
  },
  suggestionDismissText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm, color: Colors.textMuted,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  moduleIcon: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  moduleName: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.md, color: Colors.primary,
  },
  reorderActions: { flexDirection: 'row', alignItems: 'center' },
  reorderButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  reorderButtonDisabled: { opacity: 0.45 },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm, color: Colors.textMuted,
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    marginTop: Spacing.lg,
  },
  addMoreText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.md, color: Colors.accent,
  },
});
