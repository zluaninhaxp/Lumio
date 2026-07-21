import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { useAppStore } from '../../src/store';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS_SHORT = ['D','S','T','Q','Q','S','S'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarioScreen() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(
    today.toISOString().split('T')[0]
  );
  const { events, toggleEvent } = useAppStore();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const eventsForDate = (dateStr: string) =>
    events.filter((e) => e.date === dateStr);

  const hasEvents = (day: number) => {
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return eventsForDate(d).length > 0;
  };

  const selectedEvents = eventsForDate(selectedDate);

  const formatSelectedDate = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }).toUpperCase();
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const selectDay = (day: number) => {
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(d);
  };

  const isToday = (day: number) => {
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const isSelected = (day: number) => {
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return d === selectedDate;
  };

  const cells = Array(firstDay).fill(null).concat(
    Array.from({ length: daysInMonth }, (_, i) => i + 1)
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendário</Text>
        <View style={styles.avatar}><Text style={styles.avatarText}>OJ</Text></View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Calendar card */}
        <View style={styles.calCard}>
          {/* Month nav */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={styles.dayHeaders}>
            {DAYS_SHORT.map((d, i) => (
              <Text key={i} style={styles.dayHeader}>{d}</Text>
            ))}
          </View>

          {/* Grid */}
          <View style={styles.grid}>
            {cells.map((day, i) => (
              <TouchableOpacity
                key={i}
                style={styles.cell}
                onPress={() => day && selectDay(day)}
                disabled={!day}
              >
                {day && (
                  <View style={[
                    styles.dayCircle,
                    isSelected(day) && styles.dayCircleSelected,
                    isToday(day) && !isSelected(day) && styles.dayCircleToday,
                  ]}>
                    <Text style={[
                      styles.dayText,
                      isSelected(day) && styles.dayTextSelected,
                      isToday(day) && !isSelected(day) && styles.dayTextToday,
                    ]}>
                      {day}
                    </Text>
                    {hasEvents(day) && !isSelected(day) && (
                      <View style={styles.dot} />
                    )}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Events for selected day */}
        <View style={styles.eventsSection}>
          <Text style={styles.eventsDateLabel}>{formatSelectedDate()}</Text>

          {selectedEvents.length === 0 ? (
            <View style={styles.emptyEvents}>
              <Text style={styles.emptyText}>Nenhuma tarefa para este dia.</Text>
            </View>
          ) : (
            selectedEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                onPress={() => toggleEvent(event.id)}
                activeOpacity={0.7}
              >
                <TouchableOpacity
                  style={[styles.checkbox, event.done && styles.checkboxDone]}
                  onPress={() => toggleEvent(event.id)}
                >
                  {event.done && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </TouchableOpacity>
                <View style={styles.eventInfo}>
                  {event.time && (
                    <Text style={styles.eventTime}>{event.time}</Text>
                  )}
                  <Text style={[styles.eventDesc, event.done && styles.eventDescDone]}>
                    {event.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: FontSize.xxl, color: Colors.primary,
  },
  avatar: {
    width: 36, height: 36, borderRadius: Radius.full,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#FFF' },

  calCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  navBtn: { padding: Spacing.xs },
  monthLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md, color: Colors.primary,
  },
  dayHeaders: { flexDirection: 'row', marginBottom: Spacing.xs },
  dayHeader: {
    flex: 1, textAlign: 'center',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs, color: Colors.textMuted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', alignItems: 'center', paddingVertical: 4 },
  dayCircle: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  dayCircleSelected: { backgroundColor: Colors.accent },
  dayCircleToday: { borderWidth: 1.5, borderColor: Colors.accent },
  dayText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm, color: Colors.primary,
  },
  dayTextSelected: { color: '#FFF', fontFamily: 'PlusJakartaSans_700Bold' },
  dayTextToday: { color: Colors.accent, fontFamily: 'PlusJakartaSans_700Bold' },
  dot: {
    position: 'absolute', bottom: 2, width: 4, height: 4,
    borderRadius: 2, backgroundColor: Colors.accent,
  },

  eventsSection: {
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: 100,
  },
  eventsDateLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs, color: Colors.textMuted,
    letterSpacing: 1, marginBottom: Spacing.md,
  },
  emptyEvents: { paddingVertical: Spacing.xl, alignItems: 'center' },
  emptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md, color: Colors.textMuted,
  },
  eventCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    marginBottom: Spacing.sm, gap: Spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  eventInfo: { flex: 1, gap: 2 },
  eventTime: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm, color: Colors.accent,
  },
  eventDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md, color: Colors.primary,
  },
  eventDescDone: { color: Colors.textMuted, textDecorationLine: 'line-through' },
});
