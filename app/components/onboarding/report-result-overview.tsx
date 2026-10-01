import { Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { OnboardingExtractionResult } from '../../../src/ai/types';
import { Colors, FontSize, Radius, Spacing, Typography } from '../../../src/constants/theme';
import { ReportBackdrop } from './report-processing';

const DONE_IMAGE = require('../../../assets/mascote-relatorio/Mascote Alegre com Laptop e Painéis Flutuantes.png');

export type ReportSection = 'categories' | 'tags' | 'calendar' | 'plugins';

type Props = {
  extraction: OnboardingExtractionResult;
  isSimulation: boolean;
  onViewFull: () => void;
  onViewSection: (section: ReportSection) => void;
  onEditAnswers: () => void;
};

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function ReportResultOverview({ extraction, isSimulation, onViewFull, onViewSection, onEditAnswers }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableHeight = height - insets.top - insets.bottom;
  const compact = availableHeight < 650;
  const narrowGrid = width <= 340 && availableHeight < 630;
  const headerHeight = compact ? 42 : 46;
  const rowHeight = narrowGrid ? 76 : compact ? 50 : 58;
  const businessHeight = compact ? 56 : 64;
  const controlGap = compact ? 3 : 6;
  const expenseCount = extraction.coreCategories.financial.expense.length;
  const incomeCount = extraction.coreCategories.financial.income.length;
  const tagsCount = extraction.coreCategories.taskTags.length;
  const eventCount = extraction.coreCategories.calendarEventTypes.length;
  const pluginCount = extraction.recommendedPlugins.length;
  const rows: { key: ReportSection; icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }[] = [
    ...(expenseCount + incomeCount ? [{ key: 'categories' as const, icon: 'folder-outline' as const, title: 'Categorias identificadas', detail: `${countLabel(expenseCount, 'despesa', 'despesas')} · ${countLabel(incomeCount, 'receita', 'receitas')}` }] : []),
    ...(pluginCount ? [{ key: 'plugins' as const, icon: 'sparkles-outline' as const, title: 'Sugestões para o negócio', detail: countLabel(pluginCount, 'sugestão', 'sugestões') }] : []),
    ...(tagsCount ? [{ key: 'tags' as const, icon: 'pricetag-outline' as const, title: 'Tags de tarefa', detail: countLabel(tagsCount, 'tag', 'tags') }] : []),
    ...(eventCount ? [{ key: 'calendar' as const, icon: 'calendar-outline' as const, title: 'Tipos de evento', detail: countLabel(eventCount, 'tipo', 'tipos') }] : []),
  ];
  const rowLines = narrowGrid ? Math.ceil(rows.length / 2) : rows.length;
  const fixedHeight = headerHeight + (width <= 340 ? 120 : 78) + businessHeight + rowLines * rowHeight + Math.max(0, rowLines - 1) * (compact ? 3 : 5) + (compact ? 44 + 42 : 50 + 46) + (isSimulation ? 34 : 0) + controlGap * (isSimulation ? 5 : 4) + 12;
  const heroHeight = Math.max(58, Math.min(width * 0.48, 190, availableHeight - fixedHeight));
  const heroWidth = Math.min(width * 0.76, 300);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View pointerEvents="none" accessible={false} style={styles.subtleBackdrop}><ReportBackdrop /></View>
      <View style={[styles.header, { height: headerHeight }]}>
        <TouchableOpacity style={styles.backButton} onPress={onEditAnswers} accessibilityRole="button" accessibilityLabel="Voltar às respostas">
          <Ionicons name="chevron-back" size={26} color="#087E68" />
        </TouchableOpacity>
      </View>
      <View style={[styles.content, { gap: controlGap, paddingBottom: compact ? 4 : 8 }]}>
        <View style={[styles.hero, { width: heroWidth, height: heroHeight }]}>
          <Svg pointerEvents="none" style={styles.heroAtmosphere} width="120%" height="135%" viewBox="0 0 320 230">
            <Defs><RadialGradient id="heroGlow"><Stop offset="0" stopColor={Colors.accentGlow} stopOpacity="0.8" /><Stop offset="1" stopColor={Colors.accentGlow} stopOpacity="0" /></RadialGradient></Defs>
            <Path d="M4 120 C-11 69 46 32 100 49 C139 10 197 30 225 62 C282 41 334 91 309 147 C275 204 223 199 177 184 C123 214 71 199 47 168 C25 168 12 149 4 120 Z" fill={Colors.accentLight} opacity="0.35" />
            <Rect width="320" height="230" fill="url(#heroGlow)" />
          </Svg>
          <Image source={DONE_IMAGE} style={styles.illustration} resizeMode="contain" accessibilityLabel="Lumio feliz com o relatório pronto" />
        </View>
        <View style={styles.intro}>
          <Text style={styles.title}>Seu relatório está pronto!</Text>
          <Text style={styles.subtitle}>Aqui está um resumo do seu negócio, com as principais informações que identifiquei.</Text>
        </View>

        {isSimulation && <View style={styles.simBanner}><Ionicons name="flash-outline" size={17} color={Colors.warning} /><Text style={styles.simText}>Relatório simulado · estimativa local</Text></View>}

        <TouchableOpacity style={[styles.businessCard, { minHeight: businessHeight, paddingVertical: compact ? 5 : 7 }]} onPress={onEditAnswers} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Editar respostas do negócio">
          <View style={[styles.iconBox, compact && styles.iconBoxCompact]}><Ionicons name="storefront-outline" size={compact ? 21 : 24} color={Colors.accent} /></View>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle} numberOfLines={1}>{extraction.businessName || 'Seu negócio'}</Text>
            <Text style={styles.cardDetail} numberOfLines={2}>{extraction.segment || extraction.summary}</Text>
          </View>
          <View style={styles.editIcon}><Ionicons name="pencil-outline" size={18} color={Colors.accent} /></View>
        </TouchableOpacity>

        <View style={[styles.rows, narrowGrid && styles.rowsGrid, { gap: compact ? 3 : 5 }]}>
          {rows.map((row) => (
            <TouchableOpacity key={row.key} style={[styles.row, narrowGrid && styles.rowGrid, { minHeight: rowHeight, paddingVertical: compact ? 4 : 6 }]} onPress={() => onViewSection(row.key)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${row.title}, ${row.detail}`}>
              <View style={[styles.iconBox, compact && styles.iconBoxCompact, narrowGrid && styles.iconBoxGrid]}><Ionicons name={row.icon} size={narrowGrid ? 18 : compact ? 21 : 24} color={Colors.accent} /></View>
              <View style={styles.cardCopy}><Text style={styles.cardTitle} numberOfLines={narrowGrid ? 2 : undefined}>{row.title}</Text><Text style={styles.cardDetail} numberOfLines={narrowGrid ? 2 : undefined}>{row.detail}</Text></View>
              {!narrowGrid && <Ionicons name="chevron-forward" size={19} color={Colors.textSecondary} />}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.primaryButton, { minHeight: compact ? 44 : 50 }]} onPress={onViewFull} activeOpacity={0.85} accessibilityRole="button">
          <Ionicons name="document-text-outline" size={21} color={Colors.bgCard} />
          <Text style={styles.primaryText}>Ver relatório completo</Text>
          <Ionicons name="arrow-forward" size={21} color={Colors.bgCard} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryButton, { minHeight: compact ? 42 : 46 }]} onPress={onEditAnswers} activeOpacity={0.85} accessibilityRole="button">
          <Ionicons name="pencil-outline" size={18} color="#087E68" />
          <Text style={styles.secondaryText}>Editar respostas</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3FFF9', overflow: 'hidden' },
  subtleBackdrop: { ...StyleSheet.absoluteFillObject, opacity: 0.35 },
  header: { paddingHorizontal: 14, paddingTop: Spacing.sm, height: 52 },
  backButton: { width: 44, height: 44, borderRadius: 18, backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, shadowColor: '#3D8C75', shadowOpacity: 0.11, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.xl, paddingTop: 0 },
  hero: { alignItems: 'center', justifyContent: 'center' },
  heroAtmosphere: { position: 'absolute', alignSelf: 'center', opacity: 0.8 },
  illustration: { width: '100%', height: '100%' },
  intro: { alignItems: 'center', gap: Spacing.xs, maxWidth: 390 },
  title: { fontFamily: Typography.bold, fontSize: FontSize.xxl, lineHeight: 32, color: '#202B38', textAlign: 'center' },
  subtitle: { fontFamily: Typography.regular, fontSize: FontSize.sm, lineHeight: 20, color: Colors.textSecondary, textAlign: 'center' },
  simBanner: { width: '100%', maxWidth: 390, minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#FFF7E6', borderColor: '#F5C56B', borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  simText: { flex: 1, fontFamily: Typography.medium, fontSize: FontSize.xs, lineHeight: 18, color: '#7A5400' },
  businessCard: { width: '100%', maxWidth: 390, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, shadowColor: '#3D8C75', shadowOpacity: 0.1, shadowRadius: 13, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  rows: { width: '100%', maxWidth: 390, gap: 6 },
  rowsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: 7, backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, shadowColor: '#3D8C75', shadowOpacity: 0.08, shadowRadius: 11, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  rowGrid: { width: '49%', gap: Spacing.xs, paddingHorizontal: Spacing.sm },
  iconBox: { width: 42, height: 42, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentLight },
  iconBoxCompact: { width: 36, height: 36, borderRadius: Radius.md },
  iconBoxGrid: { width: 30, height: 30, borderRadius: Radius.sm },
  cardCopy: { flex: 1, minWidth: 0, gap: 2 },
  cardTitle: { fontFamily: Typography.semibold, fontSize: FontSize.sm, color: Colors.primary },
  cardDetail: { fontFamily: Typography.regular, fontSize: FontSize.xs, lineHeight: 18, color: Colors.textSecondary },
  editIcon: { width: 34, height: 34, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { width: '100%', maxWidth: 390, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radius.full, backgroundColor: Colors.accent, shadowColor: '#007F64', shadowOpacity: 0.11, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  primaryText: { fontFamily: Typography.bold, fontSize: FontSize.md, color: Colors.bgCard },
  secondaryButton: { width: '100%', maxWidth: 390, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.full, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border },
  secondaryText: { fontFamily: Typography.semibold, fontSize: FontSize.sm, color: '#087E68' },
});
