import { useSheetDraft } from '../../../src/components/sheet-draft';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ControlOpacity, Colors, Spacing, Radius, FontSize, SurfaceStyles } from '../../../src/constants/theme';
import { useAppStore } from '../../../src/store';
import { TagSelector } from '../TagSelector';
import { TaskDateSelector } from './TaskDateSelector';
import { taskFormStyles } from './taskFormStyles';
import { TaskPeopleSelector, type Relation } from './TaskPeopleSelector';

export type TaskPriority = 'alta' | 'media' | 'baixa';

export interface TaskFormData {
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
  dueDateLabel: string | null;
  tags: string[];
  clientId?: string;
  supplierId?: string;
  employeeId?: string;
}

interface TaskFormProps {
  onSave: (data: TaskFormData) => void;
  onCancel: () => void;
  initialData?: Partial<TaskFormData>;
  onBeforeNavigate?: (relation: Relation, data: TaskFormData) => void;
}

const PRIORITY_OPTIONS: { key: TaskPriority; label: string; color: string; activeBackground: string; icon: any }[] = [
  { key: 'baixa', label: 'Baixa', color: Colors.accentText, activeBackground: Colors.actionBackground, icon: 'arrow-down' },
  { key: 'media', label: 'Média', color: Colors.warningText, activeBackground: Colors.warningActionBackground, icon: 'flash' },
  { key: 'alta', label: 'Alta', color: Colors.dangerText, activeBackground: Colors.dangerActionBackground, icon: 'flag' },
];

export function TaskForm({ onSave, onCancel, initialData, onBeforeNavigate }: TaskFormProps) {
  const { taskTags, customTaskTags, addCustomTaskTag } = useAppStore();
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(initialData?.priority ?? 'baixa');
  const [dueDate, setDueDate] = useState<string | null>(initialData?.dueDate ?? null);
  const [dueDateLabel, setDueDateLabel] = useState<string | null>(initialData?.dueDateLabel ?? null);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialData?.tags ?? []);
  const [people, setPeople] = useState<{ clientId?: string; supplierId?: string; employeeId?: string }>({
    clientId: initialData?.clientId,
    supplierId: initialData?.supplierId,
    employeeId: initialData?.employeeId,
  });
  const [detailsVisible, setDetailsVisible] = useState(Boolean(initialData?.clientId || initialData?.supplierId || initialData?.employeeId));

  const requestClose = useSheetDraft({ description, priority, dueDate, dueDateLabel, selectedTags, people }, onCancel);

  const availableTags = Array.from(new Set([
    ...taskTags.map((tag) => tag.label),
    ...customTaskTags,
  ]));

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
      ...people,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{initialData ? 'Editar tarefa' : 'Nova tarefa'}</Text>

      <Text style={styles.label}>Descrição</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="O que você precisa fazer?"
        placeholderTextColor={Colors.placeholder}
        onSubmitEditing={handleSave}
        returnKeyType="done"
      />

      <Text style={styles.label}>Prioridade</Text>
      <View style={styles.priorityRow}>
        {PRIORITY_OPTIONS.map((opt) => {
          const active = priority === opt.key;
          return (
            <TouchableOpacity activeOpacity={ControlOpacity.pressed}
              key={opt.key}
              style={[styles.priorityChip, active && { backgroundColor: opt.activeBackground, borderColor: opt.activeBackground }]}
              onPress={() => setPriority(opt.key)}
            >
              <Ionicons name={opt.icon} size={13} color={active ? Colors.onAction : opt.color} />
              <Text style={[styles.priorityChipText, active && { color: Colors.onAction }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Prazo</Text>
      <TaskDateSelector
        value={dueDate}
        label={dueDateLabel}
        onChange={(value, label) => {
          setDueDate(value);
          setDueDateLabel(label);
        }}
      />

      <TagSelector
        title="Tags"
        hint="Você pode escolher mais de uma"
        tags={availableTags}
        selected={selectedTags}
        onSelect={toggleTag}
        onAdd={addCustomTaskTag}
      />

      <TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.detailsToggle} onPress={() => setDetailsVisible((visible) => !visible)}>
        <Text style={styles.detailsToggleText}>{detailsVisible ? 'Menos detalhes' : 'Mais detalhes'}</Text>
        <Ionicons name={detailsVisible ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.accentIcon} />
      </TouchableOpacity>

      {detailsVisible && (
        <TaskPeopleSelector
          {...people}
          onChange={(relation, id) => setPeople((current) => ({ ...current, [`${relation}Id`]: id }))}
          onBeforeNavigate={(relation) => onBeforeNavigate?.(relation, {
            description: description.trim(),
            priority,
            dueDate,
            dueDateLabel,
            tags: selectedTags,
            ...people,
          })}
        />
      )}

      <View style={styles.actions}>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.cancelBtn} onPress={requestClose}>
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed}
          style={[styles.saveBtn, !description.trim() && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!description.trim()}
        >
           <Text style={styles.saveBtnText}>{initialData ? 'Salvar' : 'Adicionar'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ...taskFormStyles,
  priorityRow: { flexDirection: 'row', gap: 6 },
  priorityChip: {
      ...SurfaceStyles.filter,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    borderRadius: Radius.full
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
  dateChipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  dateChipTextActive: { color: Colors.onAction },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
  },
  detailsToggleText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.accentText,
  },
  tagsRow: {
    gap: 6,
    paddingVertical: 2,
  },
  tagChip: { minHeight: 48, minWidth: 48, justifyContent: "center",
      ...SurfaceStyles.filter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full
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
  tagChipTextActive: { color: Colors.onAction },
  assigneeChip: {
      ...SurfaceStyles.filter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full
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
});
