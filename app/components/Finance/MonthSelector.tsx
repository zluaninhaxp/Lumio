import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize } from '../../../src/constants/theme';

interface MonthSelectorProps {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
}

export function MonthSelector({ label, onPrevious, onNext }: MonthSelectorProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPrevious} style={styles.arrow} hitSlop={8}>
        <Ionicons name="chevron-back" size={20} color={Colors.primary} />
      </TouchableOpacity>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity onPress={onNext} style={styles.arrow} hitSlop={8}>
        <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  arrow: {
    padding: Spacing.xs,
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.md,
    color: Colors.primary,
    minWidth: 140,
    textAlign: 'center',
  },
});
