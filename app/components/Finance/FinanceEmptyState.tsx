import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';

interface FinanceEmptyStateProps {
  hasFilters: boolean;
  onClearFilters: () => void;
  emptyMonth?: boolean;
}

export function FinanceEmptyState({
  hasFilters,
  onClearFilters,
  emptyMonth = false,
}: FinanceEmptyStateProps) {
  const isFiltered = hasFilters && !emptyMonth;

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons
          name={isFiltered ? 'search-outline' : 'wallet-outline'}
          size={28}
          color={Colors.accent}
        />
      </View>
      <Text style={styles.title}>
        {isFiltered
          ? 'Nenhum resultado encontrado'
          : emptyMonth
          ? 'Nenhuma transação neste mês'
          : 'Nenhuma transação'}
      </Text>
      <Text style={styles.subtext}>
        {isFiltered
          ? 'Tente ajustar os filtros ou buscar por outro termo.'
          : emptyMonth
          ? 'Navegue para outro mês ou adicione uma transação.'
          : 'Toque no botão + para adicionar sua primeira transação.'}
      </Text>
      {isFiltered && (
        <TouchableOpacity style={styles.clearBtn} onPress={onClearFilters}>
          <Text style={styles.clearBtnText}>Limpar filtros</Text>
        </TouchableOpacity>
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
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
  clearBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  clearBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: '#FFF',
  },
});
