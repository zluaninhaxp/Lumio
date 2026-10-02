import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing, Typography, SurfaceStyles } from '../../../src/constants/theme';
import { ReportBackdrop } from './report-processing';

const ERROR_IMAGE = require('../../../assets/mascote-relatorio/Mascote Ansioso com Laptop e Alertas.png');
const TIPS = [
  'Verificar sua conexão com a internet',
  'Revisar suas respostas',
  'Tentar novamente em alguns segundos',
];

type Props = { onRetry: () => void; onContinue: () => void; onSimulation?: () => void; finishing?: boolean; finishError?: string | null };

export default function ReportError({ onRetry, onContinue, onSimulation, finishing = false, finishError }: Props) {
  const { width, height } = useWindowDimensions();
  const compact = height < 700;
  const illustrationSize = Math.min(width, compact ? height * 0.32 : height * 0.39, 350);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ReportBackdrop />
      <ScrollView contentContainerStyle={[styles.content, compact && styles.contentCompact]} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { width: illustrationSize, height: illustrationSize }]}>
          <View pointerEvents="none" accessible={false} style={styles.heroHalo} />
          <Image source={ERROR_IMAGE} style={styles.illustration} resizeMode="contain" accessibilityLabel="Lumio preocupado diante do notebook" />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Ops! Algo deu errado</Text>
          <Text style={styles.subtitle}>Não foi possível concluir sua personalização agora. Mas você pode tentar novamente em instantes.</Text>
        </View>
        <View style={styles.helpCard}>
          <View style={styles.helpIcon}><Ionicons name="bulb-outline" size={29} color={Colors.accent} /></View>
          <View style={styles.helpCopy}>
            <Text style={styles.helpTitle}>Enquanto isso, você pode:</Text>
            {TIPS.map((tip) => <View key={tip} style={styles.tipRow}><View style={styles.dot} /><Text style={styles.tipText}>{tip}</Text></View>)}
          </View>
        </View>
        <TouchableOpacity style={styles.retryButton} onPress={onRetry} disabled={finishing} activeOpacity={0.85} accessibilityRole="button">
          <Ionicons name="refresh" size={21} color={Colors.bgCard} />
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.reviewButton} onPress={onContinue} disabled={finishing} accessibilityRole="button">
          <Text style={styles.reviewText}>{finishing ? 'Concluindo...' : 'Continuar sem personalização'}</Text>
        </TouchableOpacity>
        {!!finishError && <Text style={styles.finishError} accessibilityRole="alert">{finishError}</Text>}
        {onSimulation && <TouchableOpacity style={styles.simulationButton} onPress={onSimulation} disabled={finishing} accessibilityRole="button"><Text style={styles.simulationText}>Continuar com simulação</Text></TouchableOpacity>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3FFF9', overflow: 'hidden' },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.lg },
  contentCompact: { gap: Spacing.md },
  hero: { alignItems: 'center', justifyContent: 'center', maxWidth: '100%', marginBottom: -Spacing.lg },
  heroHalo: { position: 'absolute', width: '85%', height: '78%', borderRadius: Radius.full, backgroundColor: Colors.accentLight, opacity: 0.35, transform: [{ rotate: '-18deg' }] },
  illustration: { width: '100%', height: '100%' },
  copy: { alignItems: 'center', gap: Spacing.sm, maxWidth: 390 },
  title: { fontFamily: Typography.bold, fontSize: FontSize.xxl, lineHeight: 32, color: '#202B38', textAlign: 'center' },
  subtitle: { fontFamily: Typography.regular, fontSize: FontSize.md, lineHeight: 22, color: Colors.textSecondary, textAlign: 'center' },
  helpCard: {
      ...SurfaceStyles.card,
    width: '100%', maxWidth: 390, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.xl },
  helpIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  helpCopy: { flex: 1, gap: Spacing.sm },
  helpTitle: { fontFamily: Typography.semibold, fontSize: FontSize.sm, color: Colors.primary },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent, marginTop: 7 },
  tipText: { flex: 1, fontFamily: Typography.regular, fontSize: FontSize.sm, lineHeight: 19, color: Colors.textSecondary },
  retryButton: {
      ...SurfaceStyles.floating,
    width: '100%', maxWidth: 390, minHeight: 54, borderRadius: Radius.full, backgroundColor: Colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  retryText: { fontFamily: Typography.bold, fontSize: FontSize.md, color: Colors.bgCard },
  reviewButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  reviewText: { fontFamily: Typography.semibold, fontSize: FontSize.sm, color: '#087E68', textDecorationLine: 'underline' },
  finishError: { maxWidth: 390, fontFamily: Typography.medium, fontSize: FontSize.sm, lineHeight: 19, color: Colors.danger, textAlign: 'center' },
  simulationButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  simulationText: { fontFamily: Typography.medium, fontSize: FontSize.sm, color: Colors.textSecondary, textDecorationLine: 'underline' },
});
