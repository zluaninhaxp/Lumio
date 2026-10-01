import { useRef, useState, type ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, Radius, Spacing, Typography } from '../../../src/constants/theme';
import type { OnboardingExtractionResult } from '../../../src/ai/types';
import { editReportList, editReportOverview, getReportItems, type ReportListKey } from '../../../src/ai/reportEditing';
import { getPluginDefinition } from '../../../src/plugins/registry';
import { ReportBackdrop } from './report-processing';
import { BottomSheet, type BottomSheetHandle } from '../Calendar/BottomSheet';
import { FormLabel } from '../RequiredLabel';

const MASCOT = require('../../../assets/mascote-relatorio/Mascote gota verde translúcida com sorriso atrevido.png');
type EditKey = 'overview' | ReportListKey;
type Props = {
  extraction: OnboardingExtractionResult;
  isSimulation: boolean;
  activatedPlugins: string[];
  onBack: () => void;
  onFinish: () => void;
  onSave: (next: OnboardingExtractionResult) => Promise<void>;
  onPluginActivation: (id: string, active: boolean) => void;
  onConfigureAi: () => void;
};

function ReportSection({ icon, title, onEdit, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; onEdit?: () => void; children: ReactNode }) {
  return <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <View style={styles.iconBox}><Ionicons name={icon} size={21} color={Colors.accent} /></View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onEdit && <TouchableOpacity style={styles.editButton} onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Editar ${title}`}><Ionicons name="pencil-outline" size={16} color="#087E68" /><Text style={styles.editText}>Editar</Text></TouchableOpacity>}
    </View>
    <View style={styles.sectionBody}>{children}</View>
  </View>;
}

function ReportIntroCard() {
  return <View style={styles.intro}>
    <LinearGradient colors={['#E7FAF1', '#F8FFFB', '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
    <View pointerEvents="none" style={styles.introGlowTop} />
    <View pointerEvents="none" style={styles.introGlowBottom} />
    <View style={styles.mascotHalo}><Image source={MASCOT} style={styles.mascot} resizeMode="contain" accessibilityLabel="Lumio feliz" /></View>
    <View style={styles.introCopy}><Text style={styles.introTitle}>Tudo organizado!</Text><Text style={styles.introText}>Aqui está um resumo do que entendi sobre o seu negócio.</Text></View>
  </View>;
}

function ReportOverviewItem({ icon, label, children }: { icon: keyof typeof Ionicons.glyphMap; label: string; children: ReactNode }) {
  return <View style={styles.overviewRow}><View style={styles.smallIcon}><Ionicons name={icon} size={17} color={Colors.accent} /></View><View style={styles.overviewCopy}><Text style={styles.fieldLabel}>{label}</Text>{children}</View></View>;
}

function ReportChips({ labels }: { labels: string[] }) {
  return <View style={styles.chips}>{labels.map((label, index) => <View key={`${label}-${index}`} style={styles.chip} accessibilityLabel={label}><View style={styles.dot} /><Text style={styles.chipText}>{label}</Text></View>)}</View>;
}

const listMeta: { key: ReportListKey; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'expense', title: 'Categorias de despesa', icon: 'pie-chart-outline' },
  { key: 'income', title: 'Categorias de receita', icon: 'trending-up-outline' },
  { key: 'calendar', title: 'Tipos de evento (Calendário)', icon: 'calendar-outline' },
  { key: 'task', title: 'Tags de tarefa', icon: 'pricetag-outline' },
];

export default function ReportDetail({ extraction, isSimulation, activatedPlugins, onBack, onFinish, onSave, onPluginActivation, onConfigureAi }: Props) {
  const sheetRef = useRef<BottomSheetHandle>(null);
  const { height: screenHeight } = useWindowDimensions();
  const [editing, setEditing] = useState<EditKey | null>(null);
  const [name, setName] = useState('');
  const [segment, setSegment] = useState('');
  const [summary, setSummary] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const summaryIsLong = extraction.summary.length > 160;

  const openEditor = (key: EditKey) => {
    setError('');
    setEditing(key);
    if (key === 'overview') {
      setName(extraction.businessName ?? '');
      setSegment(extraction.segment ?? '');
      setSummary(extraction.summary);
    } else setLabels(getReportItems(extraction, key).map((item) => item.label));
  };

  const save = async () => {
    if (!editing || saving) return;
    if (editing === 'overview' && !summary.trim()) { setError('Escreva uma descrição para continuar.'); return; }
    const cleaned = labels.map((label) => label.trim()).filter(Boolean);
    if (editing !== 'overview' && new Set(cleaned.map((label) => label.toLocaleLowerCase())).size !== cleaned.length) { setError('Remova os itens repetidos.'); return; }
    const next = editing === 'overview'
      ? editReportOverview(extraction, { businessName: name, segment, summary })
      : editReportList(extraction, editing, cleaned);
    setSaving(true);
    setError('');
    try { await onSave(next); sheetRef.current?.close(); }
    catch { setError('Não foi possível salvar. Tente novamente.'); }
    finally { setSaving(false); }
  };

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <View pointerEvents="none" style={styles.backdrop}><ReportBackdrop /></View>
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Voltar à introdução"><Ionicons name="chevron-back" size={25} color="#087E68" /></TouchableOpacity>
      <Text style={styles.headerTitle}>Relatório do seu negócio</Text>
      <View style={styles.headerSpacer} />
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ReportIntroCard />
      {isSimulation && <View style={styles.simulation}><Ionicons name="information-circle-outline" size={19} color={Colors.warning} /><Text style={styles.simulationText}>Este relatório é uma simulação local. </Text><TouchableOpacity onPress={onConfigureAi} accessibilityRole="button"><Text style={styles.configureText}>Configurar IA</Text></TouchableOpacity></View>}
      <ReportSection icon="storefront-outline" title="Visão geral" onEdit={() => openEditor('overview')}>
        <ReportOverviewItem icon="storefront-outline" label="Nome do negócio"><Text style={styles.fieldValue}>{extraction.businessName || 'Não informado'}</Text></ReportOverviewItem>
        <ReportOverviewItem icon="pricetag-outline" label="Segmento"><Text style={styles.fieldValue}>{extraction.segment || 'Não informado'}</Text></ReportOverviewItem>
        <ReportOverviewItem icon="document-text-outline" label="Sobre o negócio"><Text style={styles.fieldValue} numberOfLines={summaryExpanded ? undefined : 3}>{extraction.summary || 'Não informado'}</Text>{summaryIsLong && <TouchableOpacity style={styles.expandButton} onPress={() => setSummaryExpanded((value) => !value)} accessibilityRole="button" accessibilityLabel={summaryExpanded ? 'Ver menos sobre o negócio' : 'Ver resumo completo'}><Text style={styles.expandText}>{summaryExpanded ? 'Ver menos' : 'Ver mais'}</Text><Ionicons name={summaryExpanded ? 'chevron-up' : 'chevron-down'} size={15} color="#087E68" /></TouchableOpacity>}</ReportOverviewItem>
      </ReportSection>
      {listMeta.map(({ key, title, icon }) => {
        const items = getReportItems(extraction, key);
        return <ReportSection key={key} icon={icon} title={title} onEdit={() => openEditor(key)}>{items.length ? <ReportChips labels={items.map((item) => item.label)} /> : <Text style={styles.emptyText}>Nenhum item adicionado.</Text>}</ReportSection>;
      })}
      {extraction.recommendedPlugins.length > 0 && <ReportSection icon="apps-outline" title="Apps sugeridos">
        {extraction.recommendedPlugins.map((item) => {
          const active = activatedPlugins.includes(item.plugin);
          const def = getPluginDefinition(item.plugin);
          return <View key={item.plugin} style={styles.pluginRow}><View style={styles.pluginCopy}><Text style={styles.pluginName}>{def?.label ?? item.plugin}</Text>{item.reason ? <Text style={styles.pluginReason}>{item.reason}</Text> : null}</View><TouchableOpacity onPress={() => onPluginActivation(item.plugin, !active)} style={[styles.pluginToggle, active && styles.pluginToggleActive]} accessibilityRole="button" accessibilityLabel={`${active ? 'Desativar' : 'Ativar'} ${def?.label ?? item.plugin}`}><Text style={[styles.pluginToggleText, active && styles.pluginToggleTextActive]}>{active ? 'Ativado' : 'Ativar'}</Text></TouchableOpacity></View>;
        })}
      </ReportSection>}
      <TouchableOpacity style={styles.primaryButton} onPress={onFinish} accessibilityRole="button"><Text style={styles.primaryText}>Continuar para o Lumio</Text><Ionicons name="arrow-forward" size={20} color="#FFFFFF" /></TouchableOpacity>
    </ScrollView>
    <BottomSheet ref={sheetRef} visible={editing !== null} onClose={() => setEditing(null)} dismissible={!saving} height={screenHeight} maxHeight={Math.min(screenHeight * 0.9, 720)}>
        <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Editar {editing === 'overview' ? 'visão geral' : listMeta.find((item) => item.key === editing)?.title.toLocaleLowerCase()}</Text><TouchableOpacity onPress={() => sheetRef.current?.close()} disabled={saving} accessibilityRole="button" accessibilityLabel="Fechar edição" style={styles.closeButton}><Ionicons name="close" size={20} color={Colors.textSecondary} /></TouchableOpacity></View>
        <ScrollView style={[styles.formScroll, { maxHeight: Math.max(120, Math.min(screenHeight * 0.9, 720) - 124) }]} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
          {editing === 'overview' ? <>
            <FormLabel>Nome do negócio</FormLabel><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nome do negócio" placeholderTextColor={Colors.textMuted} maxLength={100} accessibilityLabel="Nome do negócio" />
            <FormLabel>Segmento</FormLabel><TextInput style={styles.input} value={segment} onChangeText={setSegment} placeholder="Segmento" placeholderTextColor={Colors.textMuted} maxLength={120} accessibilityLabel="Segmento" />
            <FormLabel>Sobre o negócio</FormLabel><TextInput style={[styles.input, styles.multiline]} value={summary} onChangeText={setSummary} multiline textAlignVertical="top" maxLength={1200} accessibilityLabel="Sobre o negócio" />
          </> : <>
            <Text style={styles.formHint}>Edite os nomes, remova itens ou adicione novos.</Text>
            {labels.map((label, index) => <View key={index} style={styles.listInputRow}><TextInput style={[styles.input, styles.listInput]} value={label} onChangeText={(value) => setLabels((current) => current.map((item, i) => i === index ? value : item))} maxLength={80} accessibilityLabel={`Item ${index + 1}`} /><TouchableOpacity onPress={() => setLabels((current) => current.filter((_, i) => i !== index))} accessibilityRole="button" accessibilityLabel={`Remover item ${index + 1}`} style={styles.removeButton}><Ionicons name="trash-outline" size={20} color={Colors.danger} /></TouchableOpacity></View>)}
            <TouchableOpacity onPress={() => setLabels((current) => [...current, ''])} style={styles.addButton} accessibilityRole="button"><Ionicons name="add" size={20} color={Colors.accent} /><Text style={styles.addText}>Adicionar item</Text></TouchableOpacity>
          </>}
          {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
          <View style={styles.modalActions}><TouchableOpacity style={styles.cancelButton} onPress={() => sheetRef.current?.close()} disabled={saving} accessibilityRole="button"><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity><TouchableOpacity style={[styles.saveButton, saving && styles.saveDisabled]} onPress={save} disabled={saving} accessibilityRole="button"><Text style={styles.saveText}>{saving ? 'Salvando...' : 'Salvar'}</Text></TouchableOpacity></View>
        </ScrollView>
    </BottomSheet>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3FFF9', overflow: 'hidden' }, backdrop: { ...StyleSheet.absoluteFillObject, opacity: 0.38 },
  header: { minHeight: 60, paddingHorizontal: 14, paddingTop: Spacing.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(243,255,249,0.74)' },
  backButton: { width: 44, height: 44, borderRadius: 18, backgroundColor: 'rgba(246,255,251,0.86)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(216,241,231,0.9)', shadowColor: '#3D8C75', shadowOpacity: 0.09, shadowRadius: 11, shadowOffset: { width: 0, height: 3 }, elevation: 2 }, headerTitle: { flex: 1, textAlign: 'center', fontFamily: Typography.bold, fontSize: FontSize.md, color: '#202B38' }, headerSpacer: { width: 44 },
  content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.xxxl, gap: Spacing.md, width: '100%', maxWidth: 530, alignSelf: 'center' },
  intro: { minHeight: 136, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, backgroundColor: Colors.bgCard, borderRadius: Radius.xl, overflow: 'hidden', shadowColor: '#3D8C75', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  introGlowTop: { position: 'absolute', width: 170, height: 105, top: -60, right: -35, borderRadius: Radius.full, backgroundColor: Colors.accentGlow, opacity: 0.6, transform: [{ rotate: '-20deg' }] }, introGlowBottom: { position: 'absolute', width: 170, height: 90, left: -56, bottom: -44, borderRadius: Radius.full, backgroundColor: Colors.accentLight, opacity: 0.65, transform: [{ rotate: '18deg' }] },
  mascotHalo: { width: 100, height: 100, borderRadius: Radius.full, backgroundColor: 'rgba(207,247,231,0.65)', alignItems: 'center', justifyContent: 'center' }, mascot: { width: 93, height: 93 }, introCopy: { flex: 1, gap: Spacing.xs }, introTitle: { fontFamily: Typography.bold, fontSize: FontSize.xl, color: '#202B38' }, introText: { fontFamily: Typography.regular, fontSize: FontSize.sm, lineHeight: 20, color: Colors.textSecondary },
  section: { backgroundColor: 'rgba(255,255,255,0.97)', borderWidth: 1, borderColor: '#EDF5F0', borderRadius: Radius.xl, padding: Spacing.lg, shadowColor: '#3D8C75', shadowOpacity: 0.075, shadowRadius: 15, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }, iconBox: { width: 38, height: 38, borderRadius: Radius.md, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' }, sectionTitle: { flex: 1, fontFamily: Typography.semibold, fontSize: FontSize.sm, lineHeight: 18, color: '#202B38' },
  editButton: { minHeight: 40, paddingHorizontal: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: '#EEF5F1', backgroundColor: 'rgba(255,255,255,0.8)' }, editText: { fontFamily: Typography.semibold, fontSize: FontSize.xs, color: '#087E68' }, sectionBody: { paddingTop: Spacing.md },
  overviewRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: 7 }, smallIcon: { width: 32, height: 32, borderRadius: Radius.md, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' }, overviewCopy: { flex: 1, minWidth: 0, gap: 2 }, fieldLabel: { fontFamily: Typography.medium, fontSize: FontSize.xs, color: Colors.textSecondary }, fieldValue: { fontFamily: Typography.medium, fontSize: FontSize.sm, lineHeight: 21, color: '#202B38' }, expandButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' }, expandText: { fontFamily: Typography.semibold, fontSize: FontSize.xs, color: '#087E68' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#EFF5F1', backgroundColor: '#FBFEFC', borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 5, maxWidth: '100%' }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent }, chipText: { fontFamily: Typography.medium, fontSize: FontSize.xs, color: '#202B38', flexShrink: 1 },
  emptyText: { fontFamily: Typography.regular, fontSize: FontSize.xs, color: Colors.textSecondary },
  simulation: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', padding: Spacing.md, borderRadius: Radius.md, backgroundColor: '#FFF7E6' }, simulationText: { fontFamily: Typography.regular, fontSize: FontSize.xs, color: '#7A5400' }, configureText: { fontFamily: Typography.bold, fontSize: FontSize.xs, color: '#7A5400', textDecorationLine: 'underline' },
  pluginRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm }, pluginCopy: { flex: 1 }, pluginName: { fontFamily: Typography.semibold, fontSize: FontSize.sm, color: '#202B38' }, pluginReason: { fontFamily: Typography.regular, fontSize: FontSize.xs, lineHeight: 17, color: Colors.textSecondary }, pluginToggle: { minHeight: 40, justifyContent: 'center', borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.accent, paddingHorizontal: Spacing.md }, pluginToggleActive: { backgroundColor: Colors.accent }, pluginToggleText: { fontFamily: Typography.semibold, fontSize: FontSize.xs, color: Colors.accent }, pluginToggleTextActive: { color: '#FFFFFF' },
  primaryButton: { minHeight: 54, borderRadius: Radius.full, backgroundColor: Colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, shadowColor: '#007F64', shadowOpacity: 0.11, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, primaryText: { fontFamily: Typography.bold, fontSize: FontSize.sm, color: '#FFFFFF', textAlign: 'center' }, finishButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm }, finishText: { fontFamily: Typography.semibold, fontSize: FontSize.sm, color: '#087E68' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }, sheetTitle: { flex: 1, fontFamily: Typography.bold, fontSize: FontSize.xl, color: Colors.primary }, closeButton: { width: 34, height: 34, borderRadius: Radius.full, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  formScroll: {}, form: { gap: Spacing.md, paddingBottom: Spacing.xl }, formHint: { fontFamily: Typography.regular, fontSize: FontSize.sm, color: Colors.textSecondary }, input: { minHeight: 48, backgroundColor: Colors.bg, borderRadius: Radius.md, padding: Spacing.lg, fontFamily: Typography.regular, fontSize: FontSize.md, color: Colors.primary }, multiline: { minHeight: 110 }, listInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }, listInput: { flex: 1 }, removeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, addButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }, addText: { fontFamily: Typography.semibold, fontSize: FontSize.sm, color: Colors.accent }, error: { fontFamily: Typography.medium, fontSize: FontSize.sm, color: Colors.danger },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm }, cancelButton: { flex: 1, minHeight: 50, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }, cancelText: { fontFamily: Typography.semibold, fontSize: FontSize.md, color: Colors.textSecondary }, saveButton: { flex: 1, minHeight: 50, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' }, saveDisabled: { opacity: 0.55 }, saveText: { fontFamily: Typography.semibold, fontSize: FontSize.md, color: Colors.bgCard },
});
