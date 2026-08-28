import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';

export const PERIOD_LABELS = ['Esta semana', 'Próxima semana'];

const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface QuickOption {
  label: string;
  value: string | null;
  icon: any;
}

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

function getDateQuickOptions(): QuickOption[] {
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

function isSameDate(a: string | null, y: number, m: number, d: number): boolean {
  if (!a) return false;
  const parts = a.split('-');
  return parseInt(parts[0]) === y && parseInt(parts[1]) === m + 1 && parseInt(parts[2]) === d;
}

function isTodayDate(y: number, m: number, d: number): boolean {
  const now = new Date();
  return now.getFullYear() === y && now.getMonth() === m && now.getDate() === d;
}

interface TaskDateSelectorProps {
  value: string | null;
  label?: string | null;
  onChange: (value: string | null, label: string | null) => void;
  mode?: 'task' | 'calendar';
}

export function TaskDateSelector({ value, label, onChange, mode = 'task' }: TaskDateSelectorProps) {
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  const quickOptions = getDateQuickOptions().filter((option) =>
    mode === 'calendar' ? option.label === 'Hoje' || option.label === 'Amanhã' : true,
  );
  const normalizedLabel = label && PERIOD_LABELS.includes(label) ? label : null;
  const customDateSelected =
    !!value &&
    !quickOptions.some(
      (opt) => opt.value === value && normalizedLabel === (PERIOD_LABELS.includes(opt.label) ? opt.label : null),
    );

  const openCalendar = () => {
    const current = value ? new Date(`${value}T00:00:00`) : new Date();
    setCalendarYear(current.getFullYear());
    setCalendarMonth(current.getMonth());
    setCalendarVisible(true);
  };

  const selectOption = (opt: QuickOption) => {
    onChange(opt.value, PERIOD_LABELS.includes(opt.label) ? opt.label : null);
  };

  const selectCalendarDate = (day: number) => {
    const m = String(calendarMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${calendarYear}-${m}-${d}`, null);
    setCalendarVisible(false);
  };

  const goPrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarYear((y) => y - 1);
      setCalendarMonth(11);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarYear((y) => y + 1);
      setCalendarMonth(0);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={[styles.chip, customDateSelected && styles.chipActive]}
          onPress={openCalendar}
        >
          <Ionicons name="calendar-outline" size={13} color={customDateSelected ? '#FFFFFF' : Colors.textSecondary} />
          <Text style={[styles.chipText, customDateSelected && styles.chipTextActive]}>
            {customDateSelected && value
              ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
              : 'Escolher data'}
          </Text>
        </TouchableOpacity>

        {quickOptions.map((opt) => {
          const active =
            !customDateSelected &&
            value === opt.value &&
            normalizedLabel === (PERIOD_LABELS.includes(opt.label) ? opt.label : null);
          return (
            <TouchableOpacity
              key={opt.label}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => selectOption(opt)}
            >
              <Ionicons name={opt.icon} size={13} color={active ? '#FFFFFF' : Colors.textSecondary} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <Pressable style={styles.calendarOverlay} onPress={() => setCalendarVisible(false)}>
          <Pressable style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Escolher data</Text>
              <TouchableOpacity onPress={() => setCalendarVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={21} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.calendarNavigation}>
              <TouchableOpacity onPress={goPrevMonth} hitSlop={10}>
                <Ionicons name="chevron-back" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.calendarMonthLabel}>
                {MONTH_NAMES[calendarMonth]} {calendarYear}
              </Text>
              <TouchableOpacity onPress={goNextMonth} hitSlop={10}>
                <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.calendarWeekDays}>
              {WEEK_DAYS.map((day, index) => (
                <Text key={`${day}-${index}`} style={styles.calendarWeekDay}>
                  {day}
                </Text>
              ))}
            </View>
            {getCalendarDays(calendarYear, calendarMonth).map((week, weekIndex) => (
              <View key={weekIndex} style={styles.calendarWeek}>
                {week.map((day, dayIndex) =>
                  day === null ? (
                    <View key={`empty-${dayIndex}`} style={styles.calendarDayCell} />
                  ) : (
                    <TouchableOpacity
                      key={`day-${dayIndex}`}
                      style={styles.calendarDayCell}
                      onPress={() => selectCalendarDate(day)}
                    >
                      <View
                        style={[
                          styles.calendarDayCircle,
                          isTodayDate(calendarYear, calendarMonth, day) && styles.calendarDayCircleToday,
                          isSameDate(value, calendarYear, calendarMonth, day) && styles.calendarDayCircleSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            isTodayDate(calendarYear, calendarMonth, day) && !isSameDate(value, calendarYear, calendarMonth, day) && styles.calendarDayTextToday,
                            isSameDate(value, calendarYear, calendarMonth, day) && styles.calendarDayTextSelected,
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ),
                )}
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  chip: {
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
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  chipTextActive: { color: '#FFFFFF' },
  calendarOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  calendarCard: {
    width: '100%',
    maxWidth: 340,
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
  calendarDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
    backgroundColor: 'transparent',
  },
  calendarDayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  calendarDayCircleToday: { backgroundColor: Colors.accentLight },
  calendarDayCircleSelected: { backgroundColor: Colors.accent },
  calendarDayText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  calendarDayTextToday: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: Colors.accent,
  },
  calendarDayTextSelected: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
