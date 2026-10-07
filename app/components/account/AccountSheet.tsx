import { AccountRow, BusinessBadge } from '../../../src/components/account-menu';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BottomSheet } from '../Calendar/BottomSheet';
import { Colors, FontSize, Radius, Spacing, SurfaceStyles, Typography } from '../../../src/constants/theme';
import { useAuth } from '../../../src/hooks/useAuth';
import { UnsyncedChangesError } from '../../../src/contexts/AuthContext';
import { useAppStore } from '../../../src/store';
import { UserAvatar } from './UserAvatar';

export function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const businessName = useAppStore(x => x.businessName);
  const navigate = (path: '/profile' | '/settings' | '/resources') => { onClose(); router.push(path); };
  const finishLogout = async (discardUnsyncedChanges = false) => {
    try {
      await logout(discardUnsyncedChanges);
      onClose();
      router.replace('/welcome');
    } catch (error) {
      if (error instanceof UnsyncedChangesError) {
        const message = 'As últimas alterações podem não ter sido salvas na sua conta. Se sair, talvez elas não apareçam quando você entrar em outro aparelho. Deseja sair mesmo assim?';
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined' && window.confirm(`Alterações não sincronizadas\n\n${message}`)) void finishLogout(true);
        } else {
          Alert.alert('Alterações não sincronizadas', message, [
            { text: 'Continuar usando', style: 'cancel' },
            { text: 'Sair mesmo assim', style: 'destructive', onPress: () => { void finishLogout(true); } },
          ]);
        }
        return;
      }
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.alert('Erro\n\nNão foi possível sair. Tente novamente.');
      } else {
        Alert.alert('Erro', 'Não foi possível sair. Tente novamente.');
      }
    }
  };
  const confirmLogout = () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Deseja realmente sair da conta?')) void finishLogout();
      return;
    }
    Alert.alert('Sair da conta', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => { void finishLogout(); } },
    ]);
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
