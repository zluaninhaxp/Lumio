import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BottomSheet } from '../Calendar/BottomSheet';
import { Colors, FontSize, Radius, Spacing } from '../../../src/constants/theme';
import { useAuth } from '../../../src/hooks/useAuth';
import { useAppStore } from '../../../src/store';
import { UserAvatar } from './UserAvatar';

export function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const businessName = useAppStore((state) => state.businessName);
  const navigate = (path: '/profile' | '/account' | '/preferences' | '/ai-settings') => { onClose(); router.push(path); };

  const confirmLogout = () => Alert.alert('Sair da conta', 'Deseja realmente sair?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Sair', style: 'destructive', onPress: async () => { try { await logout(); onClose(); router.replace('/login'); } catch { Alert.alert('Erro', 'Não foi possível sair. Tente novamente.'); } } },
  ]);

  const items = [
    { label: 'Meu Perfil', icon: 'person-outline' as const, path: '/profile' as const },
    { label: 'Minha Conta', icon: 'shield-checkmark-outline' as const, path: '/account' as const },
    { label: 'Preferências', icon: 'settings-outline' as const, path: '/preferences' as const },
    { label: 'Inteligência Artificial', icon: 'sparkles-outline' as const, path: '/ai-settings' as const },
  ];
  return <BottomSheet visible={visible} onClose={onClose} height={520}>
    <View style={styles.identity}>
      <UserAvatar user={currentUser} size={64} />
      <View style={styles.identityText}>
        <Text style={styles.name}>{currentUser?.name || 'Usuário'}</Text>
        <Text style={styles.email}>{currentUser?.email}</Text>
        {!!businessName && <Text style={styles.business}>{businessName}</Text>}
      </View>
    </View>
    <View style={styles.divider} />
    {items.map((item) => <TouchableOpacity key={item.path} style={styles.item} onPress={() => navigate(item.path)} activeOpacity={0.7} accessibilityRole="button">
      <Ionicons name={item.icon} size={22} color={Colors.primary} /><Text style={styles.itemLabel}>{item.label}</Text><Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>)}
    <View style={styles.divider} />
    <TouchableOpacity style={styles.item} onPress={confirmLogout} activeOpacity={0.7} accessibilityRole="button">
      <Ionicons name="log-out-outline" size={22} color={Colors.danger} /><Text style={[styles.itemLabel, styles.logout]}>Sair da conta</Text>
    </TouchableOpacity>
  </BottomSheet>;
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  identityText: { flex: 1 }, name: { color: Colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.lg },
  email: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 3 }, business: { color: Colors.accent, fontSize: FontSize.sm, marginTop: 5, fontFamily: 'PlusJakartaSans_600SemiBold' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
  item: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.md }, itemLabel: { flex: 1, color: Colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md }, logout: { color: Colors.danger },
});
