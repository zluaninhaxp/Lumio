import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';
import { useAppStore } from '../../../src/store';
import { TagSelector } from '../TagSelector';

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
const CHOOSE_DATE_LABEL = 'Escolher data';

function getCalendarDays(year: number, month: number): (number | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = [];

  for (let i = 0; i < firstDow; i++) week.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

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
    { label: CHOOSE_DATE_LABEL, value: null, icon: 'calendar-outline' },
    { label: 'Hoje', value: fmt(today), icon: 'sunny-outline' },
    { label: 'Amanhã', value: fmt(tomorrow), icon: 'calendar-outline' },
    { label: 'Esta semana', value: fmt(endOfWeek), icon: 'today-outline' },
    { label: 'Próxima semana', value: fmt(nextMonday), icon: 'arrow-forward-outline' },
    { label: 'Sem data', value: null, icon: 'close-circle-outline' },
  ];
}

export function TaskForm({ onSave, onCancel }: TaskFormProps) {
  const { taskTags, customTaskTags, addCustomTaskTag, employeeItems } = useAppStore();
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('baixa');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dueDateLabel, setDueDateLabel] = useState<string | null>(null);
  const [customDateSelected, setCustomDateSelected] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState<string | undefined>();
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  const quickOptions = getDateQuickOptions();
  const availableTags = Array.from(new Set([
    ...taskTags.map((tag) => tag.label),
    ...customTaskTags,
  ]));

  const selectDateOption = (opt: { label: string; value: string | null }) => {
    if (opt.label === CHOOSE_DATE_LABEL) {
      const currentDate = dueDate ? new Date(`${dueDate}T00:00:00`) : new Date();
      setCalendarMonth(currentDate.getMonth());
      setCalendarYear(currentDate.getFullYear());
      setCalendarVisible(true);
      return;
    }
    setDueDate(opt.value);
    setDueDateLabel(PERIOD_LABELS.includes(opt.label) ? opt.label : null);
    setCustomDateSelected(false);
  };

  const selectCalendarDate = (day: number) => {
    const month = String(calendarMonth + 1).padStart(2, '0');
    const date = String(day).padStart(2, '0');
    setDueDate(`${calendarYear}-${month}-${date}`);
    setDueDateLabel(null);
    setCustomDateSelected(true);
    setCalendarVisible(false);
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
          const isChooseDate = opt.label === CHOOSE_DATE_LABEL;
          const isCustomDate = customDateSelected;
          const active = isChooseDate
            ? isCustomDate
            : !customDateSelected && dueDate === opt.value && (dueDateLabel ?? null) === (PERIOD_LABELS.includes(opt.label) ? opt.label : null);
          const label = isChooseDate && isCustomDate
            ? new Date(`${dueDate}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : opt.label;
          return (
            <TouchableOpacity
              key={opt.label}
              style={[styles.dateChip, active && styles.dateChipActive]}
              onPress={() => selectDateOption(opt)}
            >
              <Ionicons name={opt.icon} size={13} color={active ? '#FFFFFF' : Colors.textSecondary} />
              <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={calendarVisible} transparent animationType="fade" onRequestClose={() => setCalendarVisible(false)}>
        <Pressable style={styles.calendarOverlay} onPress={() => setCalendarVisible(false)}>
          <Pressable style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Escolher data</Text>
              <TouchableOpacity onPress={() => setCalendarVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={21} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.calendarNavigation}>
              <TouchableOpacity onPress={() => {
                if (calendarMonth === 0) {
                  setCalendarYear((year) => year - 1);
                  setCalendarMonth(11);
                } else setCalendarMonth((month) => month - 1);
              }}>
                <Ionicons name="chevron-back" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.calendarMonthLabel}>{new Date(calendarYear, calendarMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</Text>
              <TouchableOpacity onPress={() => {
                if (calendarMonth === 11) {
                  setCalendarYear((year) => year + 1);
                  setCalendarMonth(0);
                } else setCalendarMonth((month) => month + 1);
              }}>
                <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.calendarWeekDays}>
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.calendarWeekDay}>{day}</Text>)}
            </View>
            {getCalendarDays(calendarYear, calendarMonth).map((week, weekIndex) => (
              <View key={weekIndex} style={styles.calendarWeek}>
                {week.map((day, dayIndex) => day === null ? <View key={dayIndex} style={styles.calendarDay} /> : (
                  <TouchableOpacity key={day} style={styles.calendarDay} onPress={() => selectCalendarDate(day)}>
                    <Text style={styles.calendarDayText}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <TagSelector
        title="Tags"
        hint="Você pode escolher mais de uma"
        tags={availableTags}
        selected={selectedTags}
        onSelect={toggleTag}
        onAdd={addCustomTaskTag}
      />

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
    fontSize: FontSize.sm,
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
  calendarOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  calendarCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  calendarNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  calendarMonthLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.primary,
    textTransform: 'capitalize',
  },
  calendarWeekDays: { flexDirection: 'row', marginTop: Spacing.md },
  calendarWeekDay: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  calendarWeek: { flexDirection: 'row', marginTop: Spacing.sm },
  calendarDay: { flex: 1, alignItems: 'center', paddingVertical: 5 },
  calendarDayText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
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
