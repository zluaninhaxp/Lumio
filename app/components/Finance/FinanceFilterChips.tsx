import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';

interface FinanceFilterChipsProps {
  options: string[];
  selected: string;
  onSelect: (filter: string) => void;
}

export function FinanceFilterChips({
  options,
  selected,
  onSelect,
}: FinanceFilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {options.map((option) => {
        const active = selected === option;
        const isIncome = option === 'Entradas';
        const isExpense = option === 'Saídas';

        return (
          <TouchableOpacity
            key={option}
            style={[
              styles.chip,
              active && styles.chipActive,
              active && isIncome && styles.chipIncome,
              active && isExpense && styles.chipExpense,
            ]}
            onPress={() => onSelect(option)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                active && styles.chipTextActive,
                active && isIncome && { color: Colors.accent },
                active && isExpense && { color: Colors.danger },
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 42,
    backgroundColor: Colors.bg,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipIncome: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipExpense: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  chipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  chipTextActive: { color: '#FFF' },
});
