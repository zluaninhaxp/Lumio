import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { useAppStore, EstoqueItem } from '../../src/store';

const EMPTY_FORM = { name: '', quantity: '', unit: '', minAlert: '' };
const EMPTY_MOVEMENT = { amount: '', reason: '' };

export default function EstoqueScreen() {
  const router = useRouter();
  const { estoqueItems, stockMovements, addEstoqueItem, updateEstoqueItem, removeEstoqueItem, moveEstoqueItem, setPluginActivation } = useAppStore();
  const [query, setQuery] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [movementVisible, setMovementVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [movementItem, setMovementItem] = useState<EstoqueItem | null>(null);
  const [movementType, setMovementType] = useState<'entrada' | 'saida'>('entrada');
  const [form, setForm] = useState(EMPTY_FORM);
  const [movement, setMovement] = useState(EMPTY_MOVEMENT);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return estoqueItems.filter((item) => !normalized || `${item.name} ${item.unit}`.toLowerCase().includes(normalized));
  }, [estoqueItems, query]);

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setFormVisible(true); };
  const openEdit = (item: EstoqueItem) => { setEditingId(item.id); setForm({ name: item.name, quantity: String(item.quantity), unit: item.unit, minAlert: String(item.minAlert) }); setFormVisible(true); };
  const saveItem = () => {
    if (!form.name.trim() || !form.unit.trim()) return;
    const payload = { name: form.name.trim(), quantity: Math.max(0, Number(form.quantity) || 0), unit: form.unit.trim(), category: '', minAlert: Math.max(0, Number(form.minAlert) || 0) };
    if (editingId) updateEstoqueItem(editingId, payload); else addEstoqueItem(payload);
    setFormVisible(false);
  };
  const openMovement = (item: EstoqueItem, type: 'entrada' | 'saida') => { setMovementItem(item); setMovementType(type); setMovement(EMPTY_MOVEMENT); setMovementVisible(true); };
  const saveMovement = () => {
    if (!movementItem) return;
    const amount = Number(movement.amount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) return;
    const moved = moveEstoqueItem(movementItem.id, movementType === 'entrada' ? amount : -amount, movement.reason);
    if (!moved) Alert.alert('Movimento não realizado', 'A saída não pode deixar o estoque negativo.');
    else setMovementVisible(false);
  };
  const deleteItem = (id: string) => Alert.alert('Excluir item', 'O histórico de movimentos será preservado, mas o item será removido.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => removeEstoqueItem(id) }]);

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={24} color={Colors.primary} /></TouchableOpacity><Text style={styles.headerTitle}>Estoque</Text><TouchableOpacity onPress={() => Alert.alert('Desativar Estoque', 'O módulo sai da aba Apps, mas os dados continuam guardados.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Desativar', style: 'destructive', onPress: () => { setPluginActivation('estoque', false); router.back(); } }])} style={styles.iconBtn}><Ionicons name="ellipsis-horizontal" size={22} color={Colors.primary} /></TouchableOpacity></View>
    <View style={styles.searchBox}><Ionicons name="search-outline" size={18} color={Colors.textMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="Buscar item" placeholderTextColor={Colors.textMuted} style={styles.searchInput} /></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {filteredItems.length === 0 && <View style={styles.empty}><Ionicons name="cube-outline" size={48} color={Colors.textMuted} /><Text style={styles.emptyText}>{query ? 'Nenhum item encontrado.' : 'Nenhum item no estoque ainda.'}</Text></View>}
      {filteredItems.map((item) => {
        const low = item.quantity < item.minAlert;
        const movements = stockMovements.filter((entry) => entry.itemId === item.id).slice(0, 3);
        return <View key={item.id} style={[styles.card, low && styles.cardLow]}><TouchableOpacity style={styles.cardHeader} onPress={() => openEdit(item)}><View style={[styles.iconCircle, low && styles.iconCircleLow]}><Ionicons name="cube-outline" size={19} color={low ? Colors.danger : Colors.accent} /></View><View style={styles.cardMain}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.cardSubtitle}>{item.quantity} {item.unit} · mínimo {item.minAlert} {item.unit}</Text></View>{low && <View style={styles.alertBadge}><Ionicons name="alert-circle" size={14} color={Colors.danger} /><Text style={styles.alertText}>Baixo</Text></View>}</TouchableOpacity><View style={styles.actionRow}><TouchableOpacity style={styles.movementButton} onPress={() => openMovement(item, 'entrada')}><Ionicons name="add" size={16} color={Colors.accent} /><Text style={styles.entryText}>Entrada</Text></TouchableOpacity><TouchableOpacity style={styles.movementButton} onPress={() => openMovement(item, 'saida')}><Ionicons name="remove" size={16} color={Colors.danger} /><Text style={styles.exitText}>Saída</Text></TouchableOpacity><TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.moreButton}><Ionicons name="trash-outline" size={17} color={Colors.textMuted} /></TouchableOpacity></View>{movements.length > 0 && <View style={styles.history}><Text style={styles.historyTitle}>Últimos movimentos</Text>{movements.map((entry) => <Text key={entry.id} style={styles.historyText}>{entry.quantity > 0 ? '+' : ''}{entry.quantity} {item.unit} · {entry.reason}</Text>)}</View>}</View>;
      })}
    </ScrollView>
    <TouchableOpacity style={styles.fab} onPress={openAdd}><Ionicons name="add" size={28} color="#FFFFFF" /></TouchableOpacity>
    <Modal visible={formVisible} transparent animationType="slide" onRequestClose={() => setFormVisible(false)}><View style={styles.modalOverlay}><View style={styles.modalCard}><Text style={styles.modalTitle}>{editingId ? 'Editar item' : 'Novo item'}</Text><TextInput style={styles.input} placeholder="Nome do item" placeholderTextColor={Colors.textMuted} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} autoFocus /><TextInput style={styles.input} placeholder="Quantidade atual" placeholderTextColor={Colors.textMuted} value={form.quantity} onChangeText={(v) => setForm((f) => ({ ...f, quantity: v }))} keyboardType="decimal-pad" /><TextInput style={styles.input} placeholder="Unidade (un, kg, cx...)" placeholderTextColor={Colors.textMuted} value={form.unit} onChangeText={(v) => setForm((f) => ({ ...f, unit: v }))} /><TextInput style={styles.input} placeholder="Quantidade mínima para alerta" placeholderTextColor={Colors.textMuted} value={form.minAlert} onChangeText={(v) => setForm((f) => ({ ...f, minAlert: v }))} keyboardType="decimal-pad" /><View style={styles.modalActions}><TouchableOpacity style={styles.modalCancel} onPress={() => setFormVisible(false)}><Text style={styles.modalCancelText}>Cancelar</Text></TouchableOpacity><TouchableOpacity style={styles.modalConfirm} onPress={saveItem}><Text style={styles.modalConfirmText}>Salvar</Text></TouchableOpacity></View></View></View></Modal>
    <Modal visible={movementVisible} transparent animationType="slide" onRequestClose={() => setMovementVisible(false)}><View style={styles.modalOverlay}><View style={styles.modalCard}><Text style={styles.modalTitle}>{movementType === 'entrada' ? 'Entrada de estoque' : 'Saída de estoque'}</Text><Text style={styles.modalSubtitle}>{movementItem?.name}</Text><TextInput style={styles.amountInput} placeholder="Quantidade" placeholderTextColor={Colors.textMuted} value={movement.amount} onChangeText={(v) => setMovement((m) => ({ ...m, amount: v }))} keyboardType="decimal-pad" autoFocus /><TextInput style={styles.input} placeholder="Motivo (opcional)" placeholderTextColor={Colors.textMuted} value={movement.reason} onChangeText={(v) => setMovement((m) => ({ ...m, reason: v }))} /><View style={styles.modalActions}><TouchableOpacity style={styles.modalCancel} onPress={() => setMovementVisible(false)}><Text style={styles.modalCancelText}>Cancelar</Text></TouchableOpacity><TouchableOpacity style={[styles.modalConfirm, movementType === 'saida' && styles.exitConfirm]} onPress={saveMovement}><Text style={styles.modalConfirmText}>Confirmar</Text></TouchableOpacity></View></View></View></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md }, iconBtn: { padding: Spacing.xs }, headerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.lg, color: Colors.primary }, searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.xl, marginBottom: Spacing.md, paddingHorizontal: Spacing.lg, backgroundColor: Colors.bgCard, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border }, searchInput: { flex: 1, height: 44, color: Colors.primary }, content: { paddingHorizontal: Spacing.xl, paddingBottom: 100 }, empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md }, emptyText: { fontFamily: 'PlusJakartaSans_600SemiBold', color: Colors.textSecondary }, card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.sm }, cardLow: { borderWidth: 1, borderColor: '#F2B8B8' }, cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md }, iconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' }, iconCircleLow: { backgroundColor: Colors.dangerLight }, cardMain: { flex: 1 }, cardTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', color: Colors.primary, fontSize: FontSize.md }, cardSubtitle: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 }, alertBadge: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: Colors.dangerLight, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4 }, alertText: { color: Colors.danger, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs }, actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md }, movementButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.bg, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }, entryText: { color: Colors.accent, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs }, exitText: { color: Colors.danger, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs }, moreButton: { marginLeft: 'auto', padding: Spacing.sm }, history: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.md, paddingTop: Spacing.sm }, historyTitle: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: Spacing.xs }, historyText: { color: Colors.textSecondary, fontSize: FontSize.xs, paddingVertical: 2 }, fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', elevation: 6 }, modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }, modalCard: { backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xxl, paddingBottom: 40, gap: Spacing.md }, modalTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.xl, color: Colors.primary }, modalSubtitle: { color: Colors.textSecondary, fontSize: FontSize.md }, input: { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: Spacing.lg, color: Colors.primary }, amountInput: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.display, textAlign: 'center', color: Colors.primary, paddingVertical: Spacing.sm }, modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm }, modalCancel: { flex: 1, padding: Spacing.lg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }, modalCancelText: { fontFamily: 'PlusJakartaSans_600SemiBold', color: Colors.textSecondary }, modalConfirm: { flex: 1, padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center' }, exitConfirm: { backgroundColor: Colors.danger }, modalConfirmText: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#FFFFFF' },
});
