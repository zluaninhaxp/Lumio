import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontSize, Spacing, SurfaceStyles, Typography } from '../../src/constants/theme';
import { BackButton } from '../../src/components/back-button';
import { ReportBackdrop } from '../components/onboarding/report-processing';

export function AccountHeader({ title, onBack, refined = false }: { title: string; onBack?: () => void; refined?: boolean }) {
  return <View style={[styles.header, refined && styles.refinedHeader]}>
    {refined ? <BackButton onPress={onBack} /> : <TouchableOpacity onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Voltar"><Ionicons name="chevron-back" size={25} color={Colors.primary} /></TouchableOpacity>}
    <Text style={[styles.title, refined && styles.refinedTitle]}>{title}</Text><View style={styles.spacer} />
  </View>;
}

export function AccountScreen({ children }: { children: React.ReactNode }) { return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><ReportBackdrop variant="account" />{children}</SafeAreaView>; }
export const sharedStyles = StyleSheet.create({ scroll: { padding: Spacing.xl, paddingBottom: 40 }, section: { marginTop: Spacing.xl }, sectionTitle: { color: Colors.textMuted, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs, letterSpacing: 1, marginBottom: Spacing.sm }, card: {
    ...SurfaceStyles.card,
    borderRadius: 16, padding: Spacing.lg }, label: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: Spacing.xs, marginTop: Spacing.md }, input: {
        ...SurfaceStyles.control,
        minHeight: 48, borderRadius: 12, paddingHorizontal: Spacing.md, color: Colors.primary, fontSize: FontSize.md }, readOnly: {
            ...SurfaceStyles.controlDisabled,
            color: Colors.textSecondary }, primary: { minHeight: 52, backgroundColor: Colors.accent, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl }, primaryText: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_700Bold' }, error: { color: Colors.danger, marginTop: Spacing.md }, muted: { color: Colors.textSecondary, fontSize: FontSize.sm } });
const styles = StyleSheet.create({ refinedHeader: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm }, refinedTitle: { fontFamily: Typography.bold, color: Colors.ink, fontSize: FontSize.lg, lineHeight: 24 }, safe: { flex: 1, backgroundColor: Colors.appBackground }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }, back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, title: { flex: 1, textAlign: 'center', color: Colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.lg }, spacer: { width: 44 } });
