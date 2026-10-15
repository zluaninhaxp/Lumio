import { AccountRow, BusinessBadge } from '../account-menu';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BottomSheet } from '../Calendar/BottomSheet';
import { Colors, FontSize, Radius, Spacing, SurfaceStyles, Typography } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useAppStore } from '../../store';
import { UserAvatar } from './UserAvatar';
import { AppAlert } from "@/src/services/appAlert";

export function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const businessName = useAppStore(x => x.businessName);
  const navigate = (path: '/profile' | '/settings' | '/resources') => { onClose(); router.push(path); };
  const finishLogout = async () => {
    try {
      await logout();
      onClose();
      router.replace('/welcome');
    } catch {
      // Retain the session and unsynced journal; never offer silent data discard.
    }
  };
  const confirmLogout = () => {
    AppAlert.alert('Sair da conta', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => { void finishLogout(); } },
    ], { icon: 'log-out-outline' });
  };
  return <BottomSheet visible={visible} onClose={onClose} height={390} surface="offWhite">
    <View style={styles.identity}><UserAvatar user={currentUser} size={Spacing.xxxl * 2} /><View style={styles.identityText}><Text style={styles.name}>{currentUser?.name || 'Usuário'}</Text><Text style={styles.email}>{currentUser?.email}</Text><BusinessBadge name={businessName} /></View></View>
    <View style={styles.shortcuts}>
      <View style={styles.shortcut}><AccountRow compact iconTreatment="tonal" icon="person-outline" title="Meu perfil" subtitle="Veja e edite seus dados" onPress={() => navigate('/profile')} /></View>
      <View style={styles.shortcut}><AccountRow compact iconTreatment="tonal" icon="settings-outline" title="Configurações" subtitle="Segurança, preferências e mais" onPress={() => navigate('/settings')} /></View>
      <View style={styles.shortcut}><AccountRow compact iconTreatment="tonal" icon="sparkles-outline" title="Recursos e integrações" subtitle="IA, conectividade e ferramentas" onPress={() => navigate('/resources')} /></View>
    </View><View style={styles.divider} /><View style={styles.logout}><AccountRow icon="log-out-outline" title="Sair da conta" iconTreatment="tonal" destructive chevron={false} onPress={confirmLogout} /></View>
  </BottomSheet>;
}

const styles = StyleSheet.create({ identity: { ...SurfaceStyles.tonal, backgroundColor: Colors.accentSoft, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.xl }, shortcuts: { marginTop: Spacing.md, gap: Spacing.sm }, shortcut: { ...SurfaceStyles.list, borderRadius: Radius.xl, paddingHorizontal: Spacing.md }, identityText: { flex: 1, gap: Spacing.xs }, logout: { paddingHorizontal: Spacing.md }, name: { color: Colors.ink, fontFamily: Typography.bold, fontSize: FontSize.lg, lineHeight: 24 }, email: { color: Colors.textSecondary, fontFamily: Typography.regular, fontSize: FontSize.sm, lineHeight: 20 }, divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md }, });
