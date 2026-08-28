import React, { useState, useMemo } from 'react';
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
import type { CalendarEvent } from '../../../src/store';
import { useAppStore } from '../../../src/store';
import { TagSelector } from '../TagSelector';
import { taskFormStyles } from '../Tasks/taskFormStyles';
import { TaskDateSelector } from '../Tasks/TaskDateSelector';
import { TaskPeopleSelector, type Relation } from '../Tasks/TaskPeopleSelector';

export type EventFormData = Omit<CalendarEvent, 'id' | 'done'>;

interface EventFormProps {
  initialDate: string;
  onSave: (data: EventFormData) => void;
  onCancel: () => void;
  initialData?: Partial<EventFormData>;
  onBeforeNavigate?: (relation: Relation, data: EventFormData) => void;
}

export function EventForm({ initialDate, onSave, onCancel, initialData, onBeforeNavigate }: EventFormProps) {
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [type, setType] = useState<'event' | 'task'>(initialData?.type ?? 'event');
  const [eventType, setEventType] = useState<string>(initialData?.type === 'event' ? initialData.eventType ?? '' : '');
  const [taskTag, setTaskTag] = useState<string>(initialData?.type === 'task' ? initialData.eventType ?? '' : '');
  const [time, setTime] = useState(initialData?.time === '00:00' ? '' : initialData?.time ?? '');
  const [date, setDate] = useState(initialData?.date ?? initialDate);
  const [detailsVisible, setDetailsVisible] = useState(Boolean(initialData?.clientId || initialData?.supplierId || initialData?.employeeId));
  const [people, setPeople] = useState<{ clientId?: string; supplierId?: string; employeeId?: string }>({
    clientId: initialData?.clientId,
    supplierId: initialData?.supplierId,
    employeeId: initialData?.employeeId,
  });

  const calendarEventTypes = useAppStore((s) => s.calendarEventTypes);
  const addCalendarEventType = useAppStore((s) => s.addCalendarEventType);
  const taskTags = useAppStore((s) => s.taskTags);
  const customTaskTags = useAppStore((s) => s.customTaskTags);
  const addCustomTaskTag = useAppStore((s) => s.addCustomTaskTag);
  const eventTypeLabels = useMemo(
    () => calendarEventTypes.map((c) => c.label),
    [calendarEventTypes]
  );
  const taskTagLabels = useMemo(
    () => Array.from(new Set([...taskTags.map((tag) => tag.label), ...customTaskTags])),
    [taskTags, customTaskTags]
  );

  const formatTimeInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
  };

  const isValidTime = (value: string) => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return false;
    return Number(match[1]) <= 23 && Number(match[2]) <= 59;
  };

  const handleSave = () => {
    if (!description.trim() || (time && !isValidTime(time))) return;
    onSave({
      date,
      time: time || '00:00',
      description: description.trim(),
      type,
      eventType: type === 'event' ? (eventType || undefined) : (taskTag || undefined),
      ...people,
    });
  };

  const handleSelectType = (next: 'event' | 'task') => {
    setType(next);
    if (next === 'event' && !eventType && eventTypeLabels.length > 0) {
      setEventType(eventTypeLabels[0]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Novo compromisso</Text>

      <Text style={styles.label}>Título</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="Descreva o item..."
        placeholderTextColor={Colors.textMuted}
      />

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'event' && styles.typeBtnActive]}
          onPress={() => handleSelectType('event')}
        >
          <Text style={[styles.typeBtnText, type === 'event' && styles.typeBtnTextActive]}>
            Evento
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'task' && styles.typeBtnActive]}
          onPress={() => handleSelectType('task')}
        >
          <Text style={[styles.typeBtnText, type === 'task' && styles.typeBtnTextActive]}>
            Tarefa
          </Text>
        </TouchableOpacity>
      </View>

      {type === 'event' ? (
        <TagSelector
          title="Tipo de evento"
          hint="Escolha uma tag para encontrar esse compromisso depois"
          tags={eventTypeLabels}
          selected={eventType}
          onSelect={setEventType}
          onAdd={addCalendarEventType}
        />
      ) : (
        <TagSelector
          title="Tags da tarefa"
          hint="Escolha uma tag para organizar esta tarefa"
          tags={taskTagLabels}
          selected={taskTag}
          onSelect={setTaskTag}
          onAdd={addCustomTaskTag}
        />
      )}

      <Text style={styles.label}>Data</Text>
      <TaskDateSelector
        value={date}
        mode="calendar"
        onChange={(value) => {
          if (value) setDate(value);
        }}
      />

      <Text style={styles.label}>Horário</Text>
      <TextInput
        style={styles.input}
        value={time}
        onChangeText={(value) => setTime(formatTimeInput(value))}
        placeholder="00:00"
        placeholderTextColor={Colors.textMuted}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />

      <TouchableOpacity style={styles.detailsToggle} onPress={() => setDetailsVisible((visible) => !visible)}>
        <Text style={styles.detailsToggleText}>{detailsVisible ? 'Menos detalhes' : 'Mais detalhes'}</Text>
        <Ionicons name={detailsVisible ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.accent} />
      </TouchableOpacity>

      {detailsVisible && (
        <TaskPeopleSelector
          {...people}
          onChange={(relation, id) => setPeople((current) => ({ ...current, [`${relation}Id`]: id }))}
          onBeforeNavigate={(relation) => onBeforeNavigate?.(relation, {
            date,
            time: time || '00:00',
            description: description.trim(),
            type,
            eventType: type === 'event' ? (eventType || undefined) : (taskTag || undefined),
            ...people,
          })}
        />
      )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  ...taskFormStyles,
  typeRow: { flexDirection: 'row', gap: 6 },
  typeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
  },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  typeBtnTextActive: { color: '#FFF' },
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
    color: Colors.accent,
  },
  eventTypeRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  eventTypeChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  eventTypeChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  eventTypeChipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  eventTypeChipTextActive: { color: '#FFF' },
});
