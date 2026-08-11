import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { EmployeeItem, useAppStore } from '../../src/store';

const EMPTY = { name: '', role: '', contact: '' };

export default function EquipeScreen() {
  const router = useRouter();
  const { employeeItems, addEmployeeItem, updateEmployeeItem, removeEmployeeItem, setPluginActivation } = useAppStore();
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employeeItems.filter((employee) => !q || `${employee.name} ${employee.role} ${employee.contact}`.toLowerCase().includes(q));
  }, [employeeItems, query]);
  const openAdd = () => { setEditingId(null); setForm(EMPTY); setModalVisible(true); };
  const openEdit = (employee: EmployeeItem) => { setEditingId(employee.id); setForm({ name: employee.name, role: employee.role, contact: employee.contact }); setModalVisible(true); };
  const save = () => {
    if (!form.name.trim() || !form.role.trim()) return;
    const current = editingId ? employeeItems.find((item) => item.id === editingId) : undefined;
    const payload = { ...form, name: form.name.trim(), role: form.role.trim(), contact: form.contact.trim(), createdAt: current?.createdAt ?? new Date().toISOString() };
    if (editingId) updateEmployeeItem(editingId, payload); else addEmployeeItem(payload);
    setModalVisible(false);
  };
  const remove = (id: string) => Alert.alert('Excluir funcionário', 'As tarefas e pedidos vinculados ficarão sem funcionário.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => removeEmployeeItem(id) }]);
  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()} style={styles.icon}><Ionicons name="chevron-back" size={24} color={Colors.primary} /></TouchableOpacity><Text style={styles.title}>Equipe</Text><TouchableOpacity onPress={() => Alert.alert('Desativar Equipe', 'Os dados continuarão guardados.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Desativar', style: 'destructive', onPress: () => { setPluginActivation('equipe', false); router.back(); } }])} style={styles.icon}><Ionicons name="ellipsis-horizontal" size={22} color={Colors.primary} /></TouchableOpacity></View>
    <View style={styles.search}><Ionicons name="search-outline" size={18} color={Colors.textMuted} /><TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Buscar funcionário" placeholderTextColor={Colors.textMuted} /></View>
    <ScrollView contentContainerStyle={styles.content}>{visible.length === 0 && <View style={styles.empty}><Ionicons name="people-outline" size={48} color={Colors.textMuted} /><Text style={styles.muted}>{query ? 'Nenhum funcionário encontrado.' : 'Nenhum funcionário cadastrado ainda.'}</Text></View>}{visible.map((employee) => <TouchableOpacity key={employee.id} style={styles.card} onPress={() => openEdit(employee)} onLongPress={() => remove(employee.id)}><View style={styles.avatar}><Text style={styles.avatarText}>{employee.name.slice(0, 1).toUpperCase()}</Text></View><View style={styles.main}><Text style={styles.name}>{employee.name}</Text><Text style={styles.detail}>{employee.role} · {employee.contact || 'Sem contato informado'}</Text></View><Ionicons name="chevron-forward" size={18} color={Colors.textMuted} /></TouchableOpacity>)}</ScrollView>
    <TouchableOpacity style={styles.fab} onPress={openAdd}><Ionicons name="add" size={28} color="#FFFFFF" /></TouchableOpacity>
    <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>{editingId ? 'Editar funcionário' : 'Novo funcionário'}</Text><TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Nome" placeholderTextColor={Colors.textMuted} autoFocus /><TextInput style={styles.input} value={form.role} onChangeText={(v) => setForm((f) => ({ ...f, role: v }))} placeholder="Função" placeholderTextColor={Colors.textMuted} /><TextInput style={styles.input} value={form.contact} onChangeText={(v) => setForm((f) => ({ ...f, contact: v }))} placeholder="Contato" placeholderTextColor={Colors.textMuted} /><View style={styles.actions}><TouchableOpacity style={styles.cancel} onPress={() => setModalVisible(false)}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity><TouchableOpacity style={styles.confirm} onPress={save}><Text style={styles.confirmText}>Salvar</Text></TouchableOpacity></View></View></View></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.bg }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg }, icon: { padding: Spacing.xs }, title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.lg, color: Colors.primary }, search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.xl, marginBottom: Spacing.md, paddingHorizontal: Spacing.lg, backgroundColor: Colors.bgCard, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border }, searchInput: { flex: 1, height: 44, color: Colors.primary }, content: { paddingHorizontal: Spacing.xl, paddingBottom: 100 }, empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md }, muted: { color: Colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold' }, card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.sm }, avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: Colors.accent, fontFamily: 'PlusJakartaSans_700Bold' }, main: { flex: 1 }, name: { color: Colors.primary, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md }, detail: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 3 }, fab: { position: 'absolute', right: 24, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', elevation: 6 }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }, modal: { backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xxl, gap: Spacing.md }, modalTitle: { color: Colors.primary, fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.xl }, input: { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: Spacing.lg, color: Colors.primary }, actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm }, cancel: { flex: 1, padding: Spacing.lg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }, cancelText: { color: Colors.textSecondary, fontFamily: 'PlusJakartaSans_600SemiBold' }, confirm: { flex: 1, padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center' }, confirmText: { color: '#FFFFFF', fontFamily: 'PlusJakartaSans_600SemiBold' } });
