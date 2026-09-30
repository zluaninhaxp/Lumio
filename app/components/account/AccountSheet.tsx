import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BottomSheet } from '../Calendar/BottomSheet';
import { Colors, FontSize, Spacing } from '../../../src/constants/theme';
import { useAuth } from '../../../src/hooks/useAuth';
import { UnsyncedChangesError } from '../../../src/contexts/AuthContext';
import { useAppStore } from '../../../src/store';
import { UserAvatar } from './UserAvatar';

export function AccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const businessName = useAppStore(x => x.businessName);
  const goProfile = () => { onClose(); router.push('/profile'); };
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
  return <BottomSheet visible={visible} onClose={onClose} height={390}><View style={styles.identity}><UserAvatar user={currentUser} size={60} /><View style={styles.identityText}><Text style={styles.name}>{currentUser?.name || 'Usuário'}</Text><Text style={styles.email}>{currentUser?.email}</Text>{!!businessName && <Text style={styles.business}>{businessName}</Text>}</View></View><View style={styles.divider} /><TouchableOpacity style={styles.item} onPress={goProfile} activeOpacity={.7}><Ionicons name="person-circle-outline" size={23} color={Colors.primary} /><View style={{ flex: 1 }}><Text style={styles.itemLabel}>Perfil e configurações</Text><Text style={styles.itemHint}>Dados pessoais, senha e recursos</Text></View><Ionicons name="chevron-forward" size={18} color={Colors.textMuted} /></TouchableOpacity><View style={styles.divider} /><TouchableOpacity style={styles.item} onPress={confirmLogout} activeOpacity={.7}><Ionicons name="log-out-outline" size={22} color={Colors.danger} /><Text style={[styles.itemLabel, { color: Colors.danger }]}>Sair da conta</Text></TouchableOpacity></BottomSheet>;
}

const styles = StyleSheet.create({ identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg }, identityText: { flex: 1 }, name: { color: Colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.lg }, email: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 3 }, business: { color: Colors.accent, fontSize: FontSize.sm, marginTop: 5, fontFamily: 'PlusJakartaSans_600SemiBold' }, divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg }, item: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: Spacing.md }, itemLabel: { color: Colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md }, itemHint: { color: Colors.textSecondary, fontSize: FontSize.xs, marginTop: 3 } });
