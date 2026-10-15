import { FeedbackEmptyState } from '../empty-state';
import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ControlOpacity, Colors, Spacing, Radius, FontSize } from '../../constants/theme';

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
    <FeedbackEmptyState variant="compact" icon={isFiltered ? 'search-outline' : 'wallet-outline'}
      title={isFiltered ? 'Nenhum resultado encontrado' : emptyMonth ? 'Nenhuma transação neste mês' : 'Nenhuma transação'}
      description={isFiltered ? 'Tente ajustar os filtros ou buscar por outro termo.' : emptyMonth ? 'Navegue para outro mês ou adicione uma transação.' : 'Toque no botão + para adicionar sua primeira transação.'}>
      {isFiltered && (
        <TouchableOpacity activeOpacity={ControlOpacity.pressed} style={styles.clearBtn} onPress={onClearFilters}>
          <Text style={styles.clearBtnText}>Limpar filtros</Text>
        </TouchableOpacity>
      )}
    </FeedbackEmptyState>
  );
}

const styles = StyleSheet.create({
  clearBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.actionBackground,
  },
  clearBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.onAction,
  },
});
