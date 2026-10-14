import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ControlOpacity, Colors, Spacing, Radius, FontSize, SurfaceStyles } from '../../constants/theme';
import { CalendarDayCell } from './CalendarDayCell';
import { getCalendarTypography } from '../../utils/calendarTypography';
import type { CalendarEvent } from '../../store';

interface CollapsibleCalendarProps {
  visibleYear: number;
  visibleMonth: number;
  selectedDate: string;
  calendarExpanded: boolean;
  monthLabel: string;
  cells: (number | null)[];
  selectedWeekDays: Array<{ day: number; dateStr: string; label: string; index: number }>;
  isToday: (day: number) => boolean;
  isSelected: (day: number) => boolean;
  dateString: (day: number) => string;
  events: CalendarEvent[];
  onSelectDay: (day: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToggleExpand: () => void;
}

function getEventDotsForDay(
  dateStr: string,
  events: CalendarEvent[]
): Array<{ color: string }> {
  const dayEvents = events.filter((e) => e.date === dateStr);
  const colors: Array<{ color: string }> = [];
  const uniqueTypes = [...new Set(dayEvents.map((e) => e.type))];
  uniqueTypes.forEach((type) => {
    colors.push({ color: type === 'event' ? Colors.accentIcon : Colors.warningIcon });
  });
  if (colors.length === 0 && dayEvents.length > 0) {
    colors.push({ color: Colors.accentIcon });
  }
  return colors;
}

export function CollapsibleCalendar({
  visibleYear,
  visibleMonth,
  selectedDate,
  calendarExpanded,
  monthLabel,
  cells,
  selectedWeekDays,
  isToday,
  isSelected,
  dateString,
  events,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  onToggleExpand,
}: CollapsibleCalendarProps) {
  const { width: screenWidth, fontScale } = useWindowDimensions();
  const typography = getCalendarTypography(fontScale);
  // Seven distinct 48 dp targets; narrow phones scroll the grid, never overlap it.
  const cardContentWidth = screenWidth - Spacing.xl * 2 - SurfaceStyles.card.borderWidth * 2;
  const gridPadding = Math.max(0, Math.min(Spacing.lg, (cardContentWidth - typography.gridWidth) / 2));
  const availableGridWidth = cardContentWidth - gridPadding * 2;
  const gridWidth = Math.max(typography.gridWidth, availableGridWidth);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gridWidth <= availableGridWidth && Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 10,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > 40) {
            onPrevMonth();
          } else if (gestureState.dx < -40) {
            onNextMonth();
          }
        },
      }),
    [onPrevMonth, onNextMonth, gridWidth, availableGridWidth]
  );

  const eventDotsCache = useMemo(() => {
    const cache: Record<string, Array<{ color: string }>> = {};
    cells.forEach((day) => {
      if (day) {
        const ds = dateString(day);
        cache[ds] = getEventDotsForDay(ds, events);
      }
    });
    return cache;
  }, [cells, dateString, events]);

  const renderDay = useCallback(
    (day: number) => {
      const ds = dateString(day);
      const dots = eventDotsCache[ds] || [];
      return (
        <CalendarDayCell
          key={day}
          day={day}
          isSelected={isSelected(day)}
          isToday={isToday(day)}
          hasEvents={dots.length > 0}
          eventDots={dots}
          onPress={onSelectDay}
        />
      );
    },
    [isSelected, isToday, onSelectDay, dateString, eventDotsCache]
  );

  return (
    <View style={[styles.container, { paddingHorizontal: gridPadding }]} {...panResponder.panHandlers}>
      <View style={styles.monthNav}>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={onPrevMonth} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onToggleExpand} activeOpacity={ControlOpacity.pressed} style={{ minHeight: 48, justifyContent: 'center', flexShrink: 1 }}>
          <View style={styles.monthLabelRow}>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Ionicons
              name={calendarExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={Colors.iconMuted}
            />
          </View>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={onNextMonth} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={gridWidth > availableGridWidth}>
      <View style={{ width: gridWidth }}>
      {calendarExpanded ? (
        <>
          <View style={styles.dayHeaders}>
            {['D','S','T','Q','Q','S','S'].map((d, i) => (
              <Text key={i} style={styles.dayHeader}>{d}</Text>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((day, i) =>
              day ? (
                renderDay(day)
              ) : (
                <View key={`empty-${i}`} style={styles.cell} />
              )
            )}
          </View>
        </>
      ) : (
        <View style={styles.weekStrip}>
          {selectedWeekDays.map((wd) => {
            const isSel = wd.dateStr === selectedDate;
            const isTdy = wd.dateStr === new Date().toISOString().split('T')[0];
            const dots = getEventDotsForDay(wd.dateStr, events);
            return (
              <TouchableOpacity
                key={wd.dateStr}
                style={styles.cell}
                onPress={() => onSelectDay(wd.day)}
                activeOpacity={ControlOpacity.pressed}
              >
                <Text style={styles.weekDayLabel}>{wd.label}</Text>
                <View
                  style={[
                    styles.weekDayCircle,
                    isSel && styles.dayCircleSelected,
                    isTdy && !isSel && styles.dayCircleToday,
                    { width: typography.compactDiameter, height: typography.compactDiameter, borderRadius: typography.compactDiameter / 2 },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSel && styles.dayTextSelected,
                      isTdy && !isSel && styles.dayTextToday,
                    ]}
                  >
                    {wd.day}
                  </Text>
                </View>
                {dots.length > 0 && !isSel && (
                  <View style={styles.weekDotsRow}>
                    {dots.slice(0, 3).map((dot, i) => (
                      <View
                        key={i}
                        style={[styles.weekDot, { backgroundColor: dot.color }]}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
      ...SurfaceStyles.card,
    marginHorizontal: Spacing.xl,
    borderRadius: Radius.xl,
    padding: Spacing.lg
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  navBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  monthLabelRow: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  monthLabel: {
    flexShrink: 1,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  dayHeaders: { flexDirection: 'row', marginBottom: Spacing.xs },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { minHeight: 48, justifyContent: 'center', width: '14.285714285714286%', alignItems: 'center', paddingVertical: 4 },
  dayCircleSelected: {
    backgroundColor: Colors.actionBackground,
    borderRadius: 15,
    overflow: 'hidden',
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: Colors.accentIcon,
    borderRadius: 15,
    overflow: 'hidden',
  },
  dayText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  dayTextSelected: { color: Colors.onAction, fontFamily: 'PlusJakartaSans_700Bold' },
  dayTextToday: { color: Colors.accentText, fontFamily: 'PlusJakartaSans_700Bold' },

  weekStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  weekDayLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 2,
  },
  weekDayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  weekDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
