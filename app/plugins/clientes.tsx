import { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { useAppStore, ClienteItem } from '../../src/store';

const EMPTY_FORM = { name: '', contact: '', notes: '' };
const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

export default function ClientesScreen() {
  const router = useRouter();
  const { clienteItems, transactions, addClienteItem, updateClienteItem, removeClienteItem, setPluginActivation } = useAppStore();
  const [query, setQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return clienteItems.filter((client) => !normalized || `${client.name} ${client.contact}`.toLowerCase().includes(normalized));
  }, [clienteItems, query]);

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setModalVisible(true); };
  const openEdit = (item: ClienteItem) => {
    setEditingId(item.id);
    setForm({ name: item.name, contact: item.contact, notes: item.notes });
    setModalVisible(true);
  };
  const handleSave = () => {
    if (!form.name.trim()) return;
    const payload = { name: form.name.trim(), contact: form.contact.trim(), notes: form.notes.trim(), createdAt: editingId ? clienteItems.find((item) => item.id === editingId)?.createdAt ?? new Date().toISOString() : new Date().toISOString() };
    if (editingId) updateClienteItem(editingId, payload);
    else addClienteItem(payload);
    setModalVisible(false);
  };
  const handleDelete = (id: string) => Alert.alert('Excluir cliente', 'As receitas vinculadas ficam sem cliente, mas não são excluídas.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: () => removeClienteItem(id) },
  ]);
  const handleDeactivate = () => Alert.alert('Desativar Clientes', 'O módulo sai da aba Apps, mas os dados continuam guardados.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Desativar', style: 'destructive', onPress: () => { setPluginActivation('clientes', false); router.back(); } },
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><Ionicons name="chevron-back" size={24} color={Colors.primary} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Clientes</Text>
        <TouchableOpacity onPress={handleDeactivate} style={styles.iconBtn}><Ionicons name="ellipsis-horizontal" size={22} color={Colors.primary} /></TouchableOpacity>
      </View>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Buscar cliente" placeholderTextColor={Colors.textMuted} style={styles.searchInput} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {filteredClients.length === 0 && <View style={styles.empty}><Ionicons name="people-outline" size={48} color={Colors.textMuted} /><Text style={styles.emptyText}>{query ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}</Text></View>}
        {filteredClients.map((client) => {
           const history = transactions.filter((transaction) => transaction.clientId === client.id && transaction.amount > 0 && transaction.confirmed !== false);
           const total = history.reduce((sum, transaction) => sum + transaction.amount, 0);
           const hasPendingNote = /pend[eê]ncia|aberto|deve/i.test(client.notes);
           const hasOverdueContract = transactions.some((transaction) => transaction.clientId === client.id && transaction.contractId && transaction.amount > 0 && transaction.confirmed === false && !!transaction.expectedDate && transaction.expectedDate < new Date().toISOString().split('T')[0]);
          const expanded = expandedId === client.id;
          return (
            <View key={client.id} style={styles.card}>
              <TouchableOpacity style={styles.cardHeader} onPress={() => setExpandedId(expanded ? null : client.id)} activeOpacity={0.7}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{client.name.slice(0, 1).toUpperCase()}</Text></View>
                <View style={styles.cardMain}><Text style={styles.cardTitle}>{client.name}</Text><Text style={styles.cardSubtitle}>{client.contact || 'Sem contato informado'}</Text></View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
              </TouchableOpacity>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{history.length} receita(s) vinculada(s)</Text><Text style={styles.total}>{money(total)}</Text></View>
               {hasPendingNote && <Text style={styles.pendingText}>Pendência mencionada nas observações</Text>}
               {hasOverdueContract && <Text style={styles.pendingText}>Pendência de assinatura vencida</Text>}
              {expanded && <View style={styles.details}>
                {!!client.notes && <Text style={styles.notes}>Observações: {client.notes}</Text>}
                <Text style={styles.historyTitle}>Histórico de receitas</Text>
                {history.length === 0 ? <Text style={styles.muted}>Nenhuma receita vinculada.</Text> : history.map((transaction) => <View key={transaction.id} style={styles.historyRow}><Text style={styles.muted}>{transaction.date} · {transaction.description}</Text><Text style={styles.historyAmount}>{money(transaction.amount)}</Text></View>)}
                <View style={styles.cardActions}><TouchableOpacity onPress={() => openEdit(client)}><Text style={styles.actionText}>Editar cadastro</Text></TouchableOpacity><TouchableOpacity onPress={() => handleDelete(client.id)}><Text style={styles.deleteText}>Excluir</Text></TouchableOpacity></View>
              </View>}
            </View>
          );
        })}
      </ScrollView>
      <TouchableOpacity style={styles.fab} onPress={openAdd}><Ionicons name="add" size={28} color="#FFFFFF" /></TouchableOpacity>
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}><View style={styles.modalCard}><Text style={styles.modalTitle}>{editingId ? 'Editar cliente' : 'Novo cliente'}</Text>
          <TextInput style={styles.input} placeholder="Nome" placeholderTextColor={Colors.textMuted} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} autoFocus />
          <TextInput style={styles.input} placeholder="Contato (telefone ou e-mail)" placeholderTextColor={Colors.textMuted} value={form.contact} onChangeText={(v) => setForm((f) => ({ ...f, contact: v }))} />
          <TextInput style={[styles.input, styles.notesInput]} placeholder="Observações" placeholderTextColor={Colors.textMuted} value={form.notes} onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))} multiline />
          <View style={styles.modalActions}><TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}><Text style={styles.modalCancelText}>Cancelar</Text></TouchableOpacity><TouchableOpacity style={styles.modalConfirm} onPress={handleSave}><Text style={styles.modalConfirmText}>Salvar</Text></TouchableOpacity></View>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  iconBtn: { padding: Spacing.xs },
  headerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.lg, color: Colors.primary },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.xl, marginBottom: Spacing.md, paddingHorizontal: Spacing.lg, backgroundColor: Colors.bgCard, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, height: 44, fontFamily: 'PlusJakartaSans_400Regular', color: Colors.primary },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md, color: Colors.textSecondary },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.sm, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'PlusJakartaSans_700Bold', color: Colors.accent },
  cardMain: { flex: 1 }, cardTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md, color: Colors.primary }, cardSubtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md }, summaryLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.xs, color: Colors.textMuted }, total: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.sm, color: Colors.accent },
  pendingText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.xs, color: Colors.warning, marginTop: Spacing.xs },
  details: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.md, paddingTop: Spacing.md }, notes: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: Spacing.md }, historyTitle: { fontFamily: 'PlusJakartaSans_600SemiBold', color: Colors.primary, fontSize: FontSize.sm, marginBottom: Spacing.sm }, historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, gap: Spacing.sm }, historyAmount: { fontFamily: 'PlusJakartaSans_600SemiBold', color: Colors.accent, fontSize: FontSize.sm }, muted: { color: Colors.textMuted, fontSize: FontSize.sm, flex: 1 }, cardActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md }, actionText: { color: Colors.accent, fontFamily: 'PlusJakartaSans_600SemiBold' }, deleteText: { color: Colors.danger, fontFamily: 'PlusJakartaSans_600SemiBold' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }, modalCard: { backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xxl, paddingBottom: 40, gap: Spacing.md }, modalTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.xl, color: Colors.primary }, input: { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: Spacing.lg, fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.md, color: Colors.primary }, notesInput: { minHeight: 72, textAlignVertical: 'top' }, modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm }, modalCancel: { flex: 1, padding: Spacing.lg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }, modalCancelText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md, color: Colors.textSecondary }, modalConfirm: { flex: 1, padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center' }, modalConfirmText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md, color: '#FFFFFF' },
});
