import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';
import { useAppStore } from '../../../src/store';

export type TaskPriority = 'alta' | 'media' | 'baixa';

export interface TaskFormData {
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
  dueDateLabel: string | null;
  tags: string[];
  employeeId?: string;
}

interface TaskFormProps {
  onSave: (data: TaskFormData) => void;
  onCancel: () => void;
}

const PRIORITY_OPTIONS: { key: TaskPriority; label: string; color: string; icon: any }[] = [
  { key: 'baixa', label: 'Baixa', color: Colors.accent, icon: 'arrow-down' },
  { key: 'media', label: 'Média', color: Colors.warning, icon: 'flash' },
  { key: 'alta', label: 'Alta', color: Colors.danger, icon: 'flag' },
];

const PERIOD_LABELS = ['Esta semana', 'Próxima semana'];

function getDateQuickOptions(): { label: string; value: string | null; icon: any }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + (6 - today.getDay()));
  const nextMonday = new Date(today);
  nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  return [
    { label: 'Hoje', value: fmt(today), icon: 'sunny-outline' },
    { label: 'Amanhã', value: fmt(tomorrow), icon: 'calendar-outline' },
    { label: 'Esta semana', value: fmt(endOfWeek), icon: 'today-outline' },
    { label: 'Próxima semana', value: fmt(nextMonday), icon: 'arrow-forward-outline' },
    { label: 'Sem data', value: null, icon: 'close-circle-outline' },
  ];
}

export function TaskForm({ onSave, onCancel }: TaskFormProps) {
  const { taskTags, customTaskTags, employeeItems } = useAppStore();
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('baixa');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dueDateLabel, setDueDateLabel] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState<string | undefined>();

  const quickOptions = getDateQuickOptions();
  const availableTags = Array.from(new Set([
    ...taskTags.map((tag) => tag.label),
    ...customTaskTags,
  ]));

  const selectDateOption = (opt: { label: string; value: string | null }) => {
    setDueDate(opt.value);
    setDueDateLabel(PERIOD_LABELS.includes(opt.label) ? opt.label : null);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((current) => current.includes(tag)
      ? current.filter((item) => item !== tag)
      : [...current, tag]);
  };

  const handleSave = () => {
    if (!description.trim()) return;
    onSave({
      description: description.trim(),
      priority,
      dueDate,
      dueDateLabel,
      tags: selectedTags,
      employeeId,
    });
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Nova tarefa</Text>

      <Text style={styles.label}>Descrição</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="O que você precisa fazer?"
        placeholderTextColor={Colors.textMuted}
        onSubmitEditing={handleSave}
        returnKeyType="done"
      />

      <Text style={styles.label}>Prioridade</Text>
      <View style={styles.priorityRow}>
        {PRIORITY_OPTIONS.map((opt) => {
          const active = priority === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.priorityChip, active && { backgroundColor: opt.color, borderColor: opt.color }]}
              onPress={() => setPriority(opt.key)}
            >
              <Ionicons name={opt.icon} size={13} color={active ? '#FFFFFF' : opt.color} />
              <Text style={[styles.priorityChipText, active && { color: '#FFFFFF' }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Prazo</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateRow}
      >
        {quickOptions.map((opt) => {
          const active = dueDate === opt.value && (dueDateLabel ?? null) === (PERIOD_LABELS.includes(opt.label) ? opt.label : null);
          return (
            <TouchableOpacity
              key={opt.label}
              style={[styles.dateChip, active && styles.dateChipActive]}
              onPress={() => selectDateOption(opt)}
            >
              <Ionicons name={opt.icon} size={13} color={active ? '#FFFFFF' : Colors.textSecondary} />
              <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.label}>Tags</Text>
      {availableTags.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsRow}>
          {availableTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.tagChip, active && styles.tagChipActive]}
                onPress={() => toggleTag(tag)}
              >
                <Ionicons name={active ? 'checkmark' : 'pricetag-outline'} size={13} color={active ? '#FFFFFF' : Colors.textSecondary} />
                <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={styles.mutedText}>Nenhuma tag disponível.</Text>
      )}

      <Text style={styles.label}>Atribuir para</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
        <TouchableOpacity
          style={[styles.assigneeChip, !employeeId && styles.assigneeChipActive]}
          onPress={() => setEmployeeId(undefined)}
        >
          <Ionicons name="person-outline" size={13} color={!employeeId ? '#FFFFFF' : Colors.textSecondary} />
          <Text style={[styles.dateChipText, !employeeId && styles.dateChipTextActive]}>Ninguém</Text>
        </TouchableOpacity>
        {employeeItems.map((employee) => {
          const active = employeeId === employee.id;
          return (
            <TouchableOpacity
              key={employee.id}
              style={[styles.assigneeChip, active && styles.assigneeChipActive]}
              onPress={() => setEmployeeId(employee.id)}
            >
              <Ionicons name="person-outline" size={13} color={active ? '#FFFFFF' : Colors.textSecondary} />
              <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{employee.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, !description.trim() && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!description.trim()}
        >
          <Text style={styles.saveBtnText}>Adicionar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 500 },
  container: { gap: 4, paddingBottom: Spacing.xs },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.xl,
    color: Colors.primary,
    marginBottom: 2,
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  input: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  priorityRow: { flexDirection: 'row', gap: 6 },
  priorityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  priorityChipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  dateRow: {
    gap: 6,
    paddingVertical: 2,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  dateChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  dateChipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  dateChipTextActive: { color: '#FFF' },
  tagsRow: {
    gap: 6,
    paddingVertical: 2,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  tagChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tagChipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  tagChipTextActive: { color: '#FFFFFF' },
  assigneeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  assigneeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  mutedText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: '#FFF',
  },
});
