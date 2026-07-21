import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { useAppStore } from '../../src/store';

export default function TarefasScreen() {
  const { tasks, toggleTask, addTask, removeTask } = useAppStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  const handleAdd = () => {
    if (!newTaskText.trim()) return;
    addTask({ description: newTaskText.trim(), done: false, dueDate: null });
    setNewTaskText('');
    setModalVisible(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Excluir tarefa', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => removeTask(id) },
    ]);
  };

  const renderTask = ({ item }: { item: typeof tasks[0] }) => (
    <TouchableOpacity
      style={styles.taskCard}
      onLongPress={() => handleDelete(item.id)}
      activeOpacity={0.7}
    >
      <TouchableOpacity
        style={[styles.checkbox, item.done && styles.checkboxDone]}
        onPress={() => toggleTask(item.id)}
      >
        {item.done && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
      </TouchableOpacity>
      <Text style={[styles.taskText, item.done && styles.taskTextDone]}>
        {item.description}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tarefas</Text>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>OJ</Text>
        </View>
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={() => (
          <View style={styles.content}>
            {/* Pendentes */}
            {pending.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>PENDENTES</Text>
                {pending.map((item) => (
                  <View key={item.id}>{renderTask({ item })}</View>
                ))}
              </>
            )}

            {/* Concluídas */}
            {done.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: Spacing.xl }]}>
                  CONCLUÍDAS
                </Text>
                {done.map((item) => (
                  <View key={item.id}>{renderTask({ item })}</View>
                ))}
              </>
            )}

            {pending.length === 0 && done.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="checkmark-circle-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Nenhuma tarefa ainda.</Text>
                <Text style={styles.emptySubText}>
                  Digite no chat: "preciso fazer orçamento do seu Zé"
                </Text>
              </View>
            )}
          </View>
        )}
        keyExtractor={() => 'header'}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Modal add task */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nova tarefa</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Descrição da tarefa..."
              placeholderTextColor={Colors.textMuted}
              value={newTaskText}
              onChangeText={setNewTaskText}
              autoFocus
              onSubmitEditing={handleAdd}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleAdd}>
                <Text style={styles.modalConfirmText}>Adicionar</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: FontSize.xxl,
    color: Colors.primary,
  },
  avatar: {
    width: 36, height: 36, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13, color: '#FFFFFF',
  },
  content: { paddingHorizontal: Spacing.xl, paddingBottom: 100 },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: Radius.full,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: Colors.accent, borderColor: Colors.accent,
  },
  taskText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  taskTextDone: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: Spacing.md,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
  },
  emptySubText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  fab: {
    position: 'absolute', bottom: 90, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.xxl, paddingBottom: 40,
    gap: Spacing.lg,
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.xl, color: Colors.primary,
  },
  modalInput: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md, color: Colors.primary,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.md },
  modalCancel: {
    flex: 1, padding: Spacing.lg,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.md, color: Colors.textSecondary,
  },
  modalConfirm: {
    flex: 1, padding: Spacing.lg,
    borderRadius: Radius.md, backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.md, color: '#FFFFFF',
  },
});
