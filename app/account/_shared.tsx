import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontSize, Spacing } from '../../src/constants/theme';

export function AccountHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return <View style={styles.header}>
    <TouchableOpacity onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Voltar"><Ionicons name="chevron-back" size={25} color={Colors.primary} /></TouchableOpacity>
    <Text style={styles.title}>{title}</Text><View style={styles.spacer} />
  </View>;
}

export function AccountScreen({ children }: { children: React.ReactNode }) { return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>{children}</SafeAreaView>; }
export const sharedStyles = StyleSheet.create({ scroll: { padding: Spacing.xl, paddingBottom: 40 }, section: { marginTop: Spacing.xl }, sectionTitle: { color: Colors.textMuted, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs, letterSpacing: 1, marginBottom: Spacing.sm }, card: { backgroundColor: Colors.bgCard, borderRadius: 16, padding: Spacing.lg }, label: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: Spacing.xs, marginTop: Spacing.md }, input: { minHeight: 48, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: Spacing.md, color: Colors.primary, backgroundColor: Colors.bgCard, fontSize: FontSize.md }, readOnly: { backgroundColor: Colors.bg, color: Colors.textSecondary }, primary: { minHeight: 52, backgroundColor: Colors.accent, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl }, primaryText: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold' }, error: { color: Colors.danger, marginTop: Spacing.md }, muted: { color: Colors.textSecondary, fontSize: FontSize.sm } });
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.bg }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }, back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, title: { flex: 1, textAlign: 'center', color: Colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.lg }, spacer: { width: 44 } });
