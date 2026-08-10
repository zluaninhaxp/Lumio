import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';
import type { CalendarEvent } from '../../../src/store';

interface EventFormProps {
  initialDate: string;
  onSave: (data: Omit<CalendarEvent, 'id' | 'done'>) => void;
  onCancel: () => void;
}

export function EventForm({ initialDate, onSave, onCancel }: EventFormProps) {
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'event' | 'task'>('task');
  const [time, setTime] = useState('');
  const [date, setDate] = useState(initialDate);

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleSave = () => {
    if (!description.trim()) return;
    onSave({
      date,
      time: type === 'event' ? (time || '00:00') : null,
      description: description.trim(),
      type,
    });
  };

  const quickDate = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const str = d.toISOString().split('T')[0];
    setDate(str);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Novo item</Text>

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
          style={[styles.typeBtn, type === 'task' && styles.typeBtnActive]}
          onPress={() => setType('task')}
        >
          <Text style={[styles.typeBtnText, type === 'task' && styles.typeBtnTextActive]}>
            Tarefa
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'event' && styles.typeBtnActive]}
          onPress={() => setType('event')}
        >
          <Text style={[styles.typeBtnText, type === 'event' && styles.typeBtnTextActive]}>
            Evento
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Data</Text>
      <View style={styles.dateRow}>
        <Text style={styles.dateDisplay}>{formatDisplayDate(date)}</Text>
        <View style={styles.quickDates}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => quickDate(0)}>
            <Text style={styles.quickBtnText}>Hoje</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => quickDate(1)}>
            <Text style={styles.quickBtnText}>Amanhã</Text>
          </TouchableOpacity>
        </View>
      </View>

      {type === 'event' && (
        <>
          <Text style={styles.label}>Horário</Text>
          <TextInput
            style={styles.input}
            value={time}
            onChangeText={setTime}
            placeholder="Ex: 14:00"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numbers-and-punctuation"
          />
        </>
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
          <Text style={styles.saveBtnText}>Salvar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.xl,
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  input: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeRow: { flexDirection: 'row', gap: Spacing.sm },
  typeBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
  },
  typeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeBtnText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  typeBtnTextActive: { color: '#FFF' },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateDisplay: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.md,
    color: Colors.primary,
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickDates: { flexDirection: 'row', gap: Spacing.xs },
  quickBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentLight,
  },
  quickBtnText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.accent,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.md,
    color: '#FFF',
  },
});
