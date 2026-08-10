import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';

interface EmptyStateProps {
  filter?: 'all' | 'event' | 'task';
}

export function EmptyState({ filter }: EmptyStateProps) {
  const message =
    filter === 'event'
      ? 'Nenhum evento neste dia.'
      : filter === 'task'
      ? 'Nenhuma tarefa neste dia.'
      : 'Seu dia está livre!';

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons
          name={filter ? 'calendar-outline' : 'sunny-outline'}
          size={32}
          color={Colors.accent}
        />
      </View>
      <Text style={styles.text}>{message}</Text>
      {!filter && (
        <Text style={styles.subtext}>
          Toque no botão + para adicionar um compromisso
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.lg,
    color: Colors.primary,
    textAlign: 'center',
  },
  subtext: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
