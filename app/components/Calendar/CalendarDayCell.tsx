import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize } from '../../../src/constants/theme';

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
  return (
    <TouchableOpacity
      style={styles.cell}
      onPress={() => onPress(day)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.dayCircle,
          isSelected && styles.dayCircleSelected,
          isToday && !isSelected && styles.dayCircleToday,
        ]}
      >
        <Text
          style={[
            styles.dayText,
            isSelected && styles.dayTextSelected,
            isToday && !isSelected && styles.dayTextToday,
            dayTextStyle,
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
  cell: { width: '14.28%', alignItems: 'center', paddingVertical: 4 },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: { backgroundColor: Colors.accent },
  dayCircleToday: { borderWidth: 1.5, borderColor: Colors.accent },
  dayText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  dayTextSelected: { color: '#FFF', fontFamily: 'PlusJakartaSans_700Bold' },
  dayTextToday: { color: Colors.accent, fontFamily: 'PlusJakartaSans_700Bold' },
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
