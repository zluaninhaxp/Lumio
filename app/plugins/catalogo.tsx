import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FAB } from '../components/Calendar/FAB';
import { BottomSheet, type BottomSheetHandle } from '../components/Calendar/BottomSheet';
import { SwipeableActions } from '../components/SwipeableActions';
import { FormLabel, RequiredLabel } from '../components/RequiredLabel';
import { pluginFormStyles } from '../components/Forms/pluginFormStyles';
import { ControlOpacity, Colors, FontSize, Radius, Spacing, SurfaceStyles } from '../../src/constants/theme';
import { CatalogItem, useAppStore } from '../../src/store';
import { clearRelationDraft } from '../../src/utils/relationDraft';
import { AppAlert } from "@/src/services/appAlert";

type CatalogForm = { name: string; kind: 'produto' | 'servico'; unitPrice: string; unit: string; controlStock: boolean };
const empty: CatalogForm = { name: '', kind: 'produto', unitPrice: '', unit: '', controlStock: false };
const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

export default function CatalogoScreen() {
  const router = useRouter();
  const { returnToStock } = useLocalSearchParams<{ returnToStock?: string }>();
  const { catalogItems, addCatalogItem, updateCatalogItem, archiveCatalogItem, setPluginActivation } = useAppStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'todos' | 'produto' | 'servico'>('todos');
  const visibleSheet = useRef<BottomSheetHandle>(null);
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [typeOnlyEditing, setTypeOnlyEditing] = useState(false);
  const [form, setForm] = useState(empty);
  const reviewingType = typeOnlyEditing;
  const items = useMemo(() => catalogItems.filter((item) => item.active && (filter === 'todos' || item.kind === filter) && item.name.toLowerCase().includes(query.trim().toLowerCase())), [catalogItems, filter, query]);
  const openAdd = () => { setEditing(null); setTypeOnlyEditing(false); setForm(empty); setVisible(true); };
  const openEdit = (item: CatalogItem) => { setEditing(item.id); setTypeOnlyEditing(false); setForm({ name: item.name, kind: item.kind, unitPrice: String(item.unitPrice), unit: item.unit, controlStock: item.controlStock }); setVisible(true); };
  const openTypeReview = (item: CatalogItem) => { setEditing(item.id); setTypeOnlyEditing(true); setForm({ name: item.name, kind: item.kind, unitPrice: String(item.unitPrice), unit: item.unit, controlStock: item.controlStock }); setVisible(true); };
  const save = () => {
    const unitPrice = Number(form.unitPrice.replace(',', '.'));
    if (!form.name.trim() || !Number.isFinite(unitPrice) || unitPrice < 0) return;
    const payload = { name: form.name.trim(), kind: form.kind, unitPrice, unit: form.unit.trim(), controlStock: form.kind === 'produto' && form.controlStock };
    let createdId: string | null = null;
    if (editing) updateCatalogItem(editing, { ...payload, needsReview: false });
    else createdId = addCatalogItem(payload);
    setVisible(false);
    if (!editing && createdId && returnToStock === '1') {
      if (payload.controlStock) {
        clearRelationDraft('stock');
        router.dismissTo('/plugins/estoque');
      } else {
        router.dismissTo({ pathname: '/plugins/estoque', params: { returnToStock: '1', createdId } });
      }
    }
  };
  const archive = (id: string) => AppAlert.alert('Arquivar item', 'Ele não aparecerá em novos documentos, mas o histórico será preservado.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Arquivar', style: 'destructive', onPress: () => archiveCatalogItem(id) }]);
  const deactivate = () => AppAlert.alert('Desativar Catálogo', 'O módulo sai da aba Apps, mas os dados continuam guardados.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Desativar', style: 'destructive', onPress: () => { setPluginActivation('catalogo', false); router.back(); } }]);
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.header}><TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={() => router.back()} style={styles.icon}><Ionicons name="chevron-back" size={24} color={Colors.primary} /></TouchableOpacity><Text style={styles.title}>Catálogo</Text><TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={deactivate} style={styles.icon}><Ionicons name="ellipsis-horizontal" size={22} color={Colors.primary} /></TouchableOpacity></View>
    <View style={styles.search}><Ionicons name="search-outline" size={18} color={Colors.iconMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="Buscar produto ou serviço" placeholderTextColor={Colors.placeholder} style={styles.searchInput} /></View>
    <View style={styles.chips}>{[['todos', 'Todos'], ['produto', 'Produtos'], ['servico', 'Serviços']].map(([value, label]) => <TouchableOpacity activeOpacity={ControlOpacity.pressed} key={value} style={[styles.chip, filter === value && styles.chipActive]} onPress={() => setFilter(value as typeof filter)}><Text style={[styles.chipText, filter === value && styles.chipTextActive]}>{label}</Text></TouchableOpacity>)}</View>
    <ScrollView contentContainerStyle={styles.content}>{items.length === 0 && <View style={styles.empty}><Ionicons name="pricetags-outline" size={48} color={Colors.decorativeMuted} /><Text style={styles.emptyText}>{query ? 'Nenhum item encontrado.' : 'Nenhum item no catálogo ainda.'}</Text></View>}{items.map((item) => <SwipeableActions key={item.id} onEdit={() => openEdit(item)} onDelete={() => archive(item.id)}><View style={styles.card}><View style={styles.cardIcon}><Ionicons name={item.kind === 'produto' ? 'cube-outline' : 'construct-outline'} size={19} color={item.needsReview ? Colors.warningIcon : Colors.accentIcon} /></View><View style={styles.cardMain}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.cardSubtitle}>{item.needsReview ? 'Tipo pendente de confirmação' : item.kind === 'produto' ? 'Produto' : 'Serviço'} · {item.unit}{item.controlStock ? ' · estoque controlado' : ''}</Text><Text style={styles.price}>{money(item.unitPrice)}</Text>{item.needsReview && <TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.reviewButton} onPress={() => openTypeReview(item)}><Ionicons name="alert-circle-outline" size={16} color={Colors.warningIcon} /><Text style={styles.reviewButtonText}>Confirmar tipo</Text></TouchableOpacity>}</View></View></SwipeableActions>)}</ScrollView>
    <FAB respectBottomInset onPress={openAdd} />
    <BottomSheet ref={visibleSheet} draft={form} visible={visible} onClose={() => setVisible(false)} height={620}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{reviewingType ? 'Confirmar tipo do item' : editing ? 'Editar item' : 'Novo item'}</Text>
          {reviewingType && <Text style={styles.reviewHint}>Este item foi criado sem um tipo definido. Confirme se ele é um produto ou serviço.</Text>}
          {!typeOnlyEditing && <>
            <RequiredLabel>Nome do item</RequiredLabel>
            <TextInput autoFocus style={styles.input} value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} placeholder="Nome do produto ou serviço" placeholderTextColor={Colors.placeholder} />
          </>}
          <FormLabel>{editing && catalogItems.find((item) => item.id === editing)?.needsReview ? 'Tipo (confirme)' : 'Tipo'}</FormLabel>
          <View style={styles.typeRow}>
            {([
              ['produto', 'Produto'],
              ['servico', 'Serviço'],
            ] as const).filter(([kind]) => returnToStock !== '1' || kind === 'produto').map(([kind, label]) => (
              <TouchableOpacity activeOpacity={ControlOpacity.pressed} key={kind} style={[styles.chip, form.kind === kind && styles.chipActive]} onPress={() => setForm((current) => ({ ...current, kind, controlStock: kind === 'produto' ? current.controlStock : false }))}>
                <Text style={[styles.chipText, form.kind === kind && styles.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!typeOnlyEditing && <>
            <RequiredLabel>Preço padrão</RequiredLabel>
            <TextInput style={styles.input} value={form.unitPrice} onChangeText={(unitPrice) => setForm((current) => ({ ...current, unitPrice }))} placeholder="0,00" placeholderTextColor={Colors.placeholder} keyboardType="decimal-pad" />
            <FormLabel>Unidade (opcional)</FormLabel>
            <TextInput style={styles.input} value={form.unit} onChangeText={(unit) => setForm((current) => ({ ...current, unit }))} placeholder="un, kg, hora, sessão..." placeholderTextColor={Colors.placeholder} />
          </>}
          {!typeOnlyEditing && form.kind === 'produto' && (
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Controlar estoque</Text>
                <Text style={styles.toggleDescription}>Validar disponibilidade e baixar quantidade nas vendas</Text>
              </View>
              <Switch value={form.controlStock} onValueChange={(controlStock) => setForm((current) => ({ ...current, controlStock }))} trackColor={{ false: Colors.border, true: Colors.accent }} thumbColor="#FFFFFF" />
            </View>
          )}
          <View style={styles.modalActions}>
            <TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.modalCancel} onPress={() => visibleSheet.current?.requestClose()}><Text style={styles.modalCancelText}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.modalConfirm} onPress={save}><Text style={styles.modalConfirmText}>{reviewingType ? 'Confirmar tipo' : 'Salvar'}</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </BottomSheet>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.appBackground },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.lg },
  search: {
      ...SurfaceStyles.control,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.xl, paddingHorizontal: Spacing.lg, borderRadius: Radius.full },
  searchInput: { flex: 1, height: 44, color: Colors.primary },
  chips: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  chip: {
      ...SurfaceStyles.filter,
    borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: FontSize.xs },
  chipTextActive: { color: Colors.onAction },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyText: { color: Colors.textSecondary },
  card: {
      ...SurfaceStyles.card,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.sm },
  cardIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  cardMain: { flex: 1 },
  cardTitle: { color: Colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md },
  cardSubtitle: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  price: { color: Colors.accentText, fontFamily: 'PlusJakartaSans_600SemiBold', marginTop: 2 },
  modalOverlay: {
      ...SurfaceStyles.backdrop,
    flex: 1, justifyContent: 'flex-end' },
  modalCard: {
      ...SurfaceStyles.overlay,
    width: '100%', gap: Spacing.md },
  modalTitle: pluginFormStyles.modalTitle,
  input: pluginFormStyles.input,
  modalActions: pluginFormStyles.modalActions,
  modalCancel: pluginFormStyles.modalCancel,
  modalCancelText: pluginFormStyles.modalCancelText,
  modalConfirm: pluginFormStyles.modalConfirm,
  modalConfirmText: pluginFormStyles.modalConfirmText,
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  toggleCopy: { flex: 1, gap: 2 },
  toggleTitle: { color: Colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold' },
  toggleDescription: { color: Colors.textSecondary, fontSize: FontSize.xs },
  reviewHint: { color: Colors.warningText, fontSize: FontSize.sm, lineHeight: 20 },
  reviewButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: Spacing.xs, marginTop: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: '#FFF7E6', borderWidth: 1, borderColor: '#F8D28A' },
  reviewButtonText: { color: '#A16207', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs },
  ...pluginFormStyles,
});
