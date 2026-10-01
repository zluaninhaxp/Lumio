import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Spacing, Typography } from '../../../src/constants/theme';
import { ReportBackdrop } from './report-processing';

const REPORT_IMAGE = require('../../../assets/mascote-relatorio/Mascote Alegre com Laptop e Painéis Flutuantes.png');

type Props = { onBack: () => void; onExplore: () => void; isSimulation?: boolean };

export default function ReportIntro({ onBack, onExplore, isSimulation = false }: Props) {
  const { width, height } = useWindowDimensions();
  const compact = height < 700;
  const heroSize = Math.min(width * 0.8, height * (compact ? 0.3 : 0.35), 330);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View pointerEvents="none" accessible={false} style={styles.backdrop}><ReportBackdrop /></View>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Voltar ao resumo">
          <Ionicons name="chevron-back" size={26} color="#087E68" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={[styles.content, compact && styles.contentCompact]} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { width: heroSize, height: heroSize }]}>
          <View pointerEvents="none" accessible={false} style={styles.halo} />
          <Image source={REPORT_IMAGE} style={styles.illustration} resizeMode="contain" accessibilityLabel="Lumio feliz com o relatório" />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Seu relatório completo{'\n'}está pronto!</Text>
          <Text style={styles.description}>Confira um panorama detalhado do seu negócio, com base nas suas respostas do onboarding.</Text>
        </View>
        <View style={styles.infoCard}>
          <View style={styles.infoIcon}><Ionicons name="information-circle-outline" size={28} color={Colors.accent} /></View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoTitle}>Importante</Text>
            <Text style={styles.infoText}>{isSimulation ? 'Este é um relatório simulado com base nas informações que você nos forneceu. Ele serve como um ponto de partida e pode ser editado a qualquer momento.' : 'Este é um relatório gerado por IA com base nas informações que você nos forneceu. Ele serve como um ponto de partida e pode ser editado a qualquer momento.'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.exploreButton} onPress={onExplore} activeOpacity={0.85} accessibilityRole="button">
          <Ionicons name="document-text-outline" size={21} color={Colors.bgCard} />
          <Text style={styles.exploreText}>Explorar meu relatório</Text>
          <Ionicons name="arrow-forward" size={21} color={Colors.bgCard} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3FFF9', overflow: 'hidden' },
  backdrop: { ...StyleSheet.absoluteFillObject, opacity: 0.52 },
  header: { paddingHorizontal: 14, paddingTop: Spacing.sm, height: 60 },
  backButton: { width: 44, height: 44, borderRadius: 18, backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, shadowColor: '#3D8C75', shadowOpacity: 0.11, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl, gap: Spacing.lg },
  contentCompact: { gap: Spacing.md },
  hero: { alignItems: 'center', justifyContent: 'center', maxWidth: '100%' },
  halo: { position: 'absolute', width: '85%', height: '80%', borderRadius: Radius.full, backgroundColor: Colors.accentLight, opacity: 0.35, transform: [{ rotate: '-18deg' }] },
  illustration: { width: '100%', height: '100%' },
  copy: { maxWidth: 390, alignItems: 'center', gap: Spacing.md },
  title: { fontFamily: Typography.bold, fontSize: FontSize.xxl, lineHeight: 32, color: '#202B38', textAlign: 'center' },
  description: { fontFamily: Typography.regular, fontSize: FontSize.md, lineHeight: 23, color: Colors.textSecondary, textAlign: 'center' },
  infoCard: { width: '100%', maxWidth: 390, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.lg, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl, shadowColor: '#3D8C75', shadowOpacity: 0.1, shadowRadius: 15, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  infoIcon: { width: 50, height: 50, borderRadius: Radius.full, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  infoCopy: { flex: 1, gap: Spacing.xs },
  infoTitle: { fontFamily: Typography.bold, fontSize: FontSize.md, color: Colors.primary },
  infoText: { fontFamily: Typography.regular, fontSize: FontSize.sm, lineHeight: 20, color: Colors.textSecondary },
  exploreButton: { width: '100%', maxWidth: 390, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.accent, borderRadius: Radius.full, shadowColor: '#007F64', shadowOpacity: 0.11, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  exploreText: { fontFamily: Typography.bold, fontSize: FontSize.md, color: Colors.bgCard },
});
