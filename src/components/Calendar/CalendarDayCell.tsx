import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { getCalendarTypography } from '../../utils/calendarTypography';
import { ControlOpacity, Colors, FontSize } from '../../constants/theme';

interface CalendarDayCellProps {
  day: number;
  isSelected: boolean;
  isToday: boolean;
  hasEvents: boolean;
  eventDots: Array<{ color: string }>;
  onPress: (day: number) => void;
  dayTextStyle?: object;
}

function CalendarDayCellComponent({
  day,
  isSelected,
  isToday,
  hasEvents,
  eventDots,
  onPress,
  dayTextStyle,
}: CalendarDayCellProps) {
  const { fontScale } = useWindowDimensions();
  const { monthDiameter } = getCalendarTypography(fontScale);
  return (
    <TouchableOpacity
      style={styles.cell}
      onPress={() => onPress(day)}
      activeOpacity={ControlOpacity.pressed}
    >
      <View
        style={[
          styles.dayCircle,
          isSelected && styles.dayCircleSelected,
          isToday && !isSelected && styles.dayCircleToday,
          { width: monthDiameter, height: monthDiameter, borderRadius: monthDiameter / 2 },
        ]}
      >
        <Text
          style={[
            styles.dayText,
            dayTextStyle,
            isSelected && styles.dayTextSelected,
            isToday && !isSelected && styles.dayTextToday,
          ]}
        >
          {day}
        </Text>
        {hasEvents && !isSelected && (
          <View style={styles.dotsRow}>
            {eventDots.slice(0, 3).map((dot, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: dot.color }]}
              />
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export const CalendarDayCell = React.memo(CalendarDayCellComponent);

const styles = StyleSheet.create({
  cell: { minHeight: 48, justifyContent: 'center', width: '14.285714285714286%', alignItems: 'center', paddingVertical: 4 },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: Colors.actionBackground,
    borderRadius: 17,

  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: Colors.accentIcon,
    borderRadius: 17,

  },
  dayText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    includeFontPadding: false,
    textAlign: 'center',
    color: Colors.primary,
  },
  dayTextSelected: { color: Colors.onAction, fontFamily: 'PlusJakartaSans_700Bold' },
  dayTextToday: { color: Colors.accentText, fontFamily: 'PlusJakartaSans_700Bold' },
  dotsRow: {
    position: 'absolute',
    bottom: 2,
    flexDirection: 'row',
    gap: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
