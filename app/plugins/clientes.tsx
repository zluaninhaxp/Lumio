import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { useAppStore, ClienteItem } from '../../src/store';

const EMPTY_FORM = { name: '', contact: '', pending: '', lastInteraction: '' };

export default function ClientesScreen() {
  const router = useRouter();
  const { clienteItems, addClienteItem, updateClienteItem, removeClienteItem, setPluginActivation } =
    useAppStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (item: ClienteItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      contact: item.contact,
      pending: item.pending,
      lastInteraction: item.lastInteraction,
    });
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      contact: form.contact.trim(),
      pending: form.pending.trim(),
      lastInteraction: form.lastInteraction.trim(),
    };
    if (editingId) {
      updateClienteItem(editingId, payload);
    } else {
      addClienteItem(payload);
    }
    setModalVisible(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Excluir cliente', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => removeClienteItem(id) },
    ]);
  };

  const handleDeactivate = () => {
    Alert.alert(
      'Desativar Clientes',
      'O módulo sai da aba Apps, mas seus dados continuam guardados e voltam se você reativar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: () => {
            setPluginActivation('clientes', false);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Clientes</Text>
        <TouchableOpacity onPress={handleDeactivate} style={styles.iconBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {clienteItems.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum cliente cadastrado ainda.</Text>
          </View>
        )}
        {clienteItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onPress={() => openEdit(item)}
            onLongPress={() => handleDelete(item.id)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSubtitle}>{item.contact || 'Sem contato'}</Text>
              {!!item.pending && <Text style={styles.pendingText}>{item.pending}</Text>}
            </View>
            {!!item.lastInteraction && (
              <Text style={styles.lastInteraction}>{item.lastInteraction}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingId ? 'Editar cliente' : 'Novo cliente'}</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome"
              placeholderTextColor={Colors.textMuted}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Contato (telefone ou e-mail)"
              placeholderTextColor={Colors.textMuted}
              value={form.contact}
              onChangeText={(v) => setForm((f) => ({ ...f, contact: v }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Pendências"
              placeholderTextColor={Colors.textMuted}
              value={form.pending}
              onChangeText={(v) => setForm((f) => ({ ...f, pending: v }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Última interação"
              placeholderTextColor={Colors.textMuted}
              value={form.lastInteraction}
              onChangeText={(v) => setForm((f) => ({ ...f, lastInteraction: v }))}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleSave}>
                <Text style={styles.modalConfirmText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  iconBtn: { padding: Spacing.xs },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.lg, color: Colors.primary,
  },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyText: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md, color: Colors.textSecondary,
  },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm, gap: Spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md, color: Colors.primary,
  },
  cardSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.sm, color: Colors.textSecondary,
    marginTop: 2,
  },
  pendingText: {
    fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.xs, color: Colors.warning,
    marginTop: 2,
  },
  lastInteraction: {
    fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.xs, color: Colors.textMuted,
  },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.xxl, paddingBottom: 40, gap: Spacing.md,
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.xl, color: Colors.primary,
  },
  input: {
    backgroundColor: Colors.bg, borderRadius: Radius.md, padding: Spacing.lg,
    fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.md, color: Colors.primary,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  modalCancel: {
    flex: 1, padding: Spacing.lg, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md, color: Colors.textSecondary,
  },
  modalConfirm: {
    flex: 1, padding: Spacing.lg, borderRadius: Radius.md,
    backgroundColor: Colors.accent, alignItems: 'center',
  },
  modalConfirmText: {
    fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.md, color: '#FFFFFF',
  },
});
