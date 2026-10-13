import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ControlOpacity, Colors, Spacing, FontSize } from '../../../src/constants/theme';

interface MonthSelectorProps {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
}

export function MonthSelector({ label, onPrevious, onNext }: MonthSelectorProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={onPrevious} style={styles.arrow}>
        <Ionicons name="chevron-back" size={20} color={Colors.primary} />
      </TouchableOpacity>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={onNext} style={styles.arrow}>
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
    width: 48, height: 48, alignItems: 'center', justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.md,
    color: Colors.primary,
    minWidth: 140,
    textAlign: 'center',
  },
});
