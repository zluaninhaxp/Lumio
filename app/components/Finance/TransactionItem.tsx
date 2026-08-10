import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';
import { getCategoryIcon, getCategoryIconColor } from '../../../src/hooks/useFinanceState';
import type { Transaction } from '../../../src/store';

interface TransactionItemProps {
  item: Transaction;
  fmt: (v: number) => string;
  selectionMode: boolean;
  isSelected: boolean;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (item: Transaction) => void;
  onSwipeOpen: (ref: Swipeable | null) => void;
}

export function TransactionItem({
  item,
  fmt,
  selectionMode,
  isSelected,
  onPress,
  onLongPress,
  onDelete,
  onEdit,
  onSwipeOpen,
}: TransactionItemProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const handleSwipeOpen = useCallback(() => {
    onSwipeOpen(swipeableRef.current);
  }, [onSwipeOpen]);

  const renderRightActions = useCallback(
    () => {
      return (
        <TouchableOpacity
          style={styles.deleteAction}
          onPress={() => {
            swipeableRef.current?.close();
            onDelete(item.id);
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#FFF" />
          <Text style={styles.actionText}>Excluir</Text>
        </TouchableOpacity>
      );
    },
    [item.id, onDelete]
  );

  const renderLeftActions = useCallback(
    () => {
      return (
        <View style={styles.leftActions}>
          <TouchableOpacity
            style={styles.editAction}
            onPress={() => {
              swipeableRef.current?.close();
              onEdit(item);
            }}
          >
            <Ionicons name="pencil-outline" size={18} color="#FFF" />
            <Text style={styles.actionText}>Editar</Text>
          </TouchableOpacity>
        </View>
      );
    },
    [item, onEdit]
  );

  const isIncome = item.amount > 0;
  const iconName = getCategoryIcon(item.category);
  const iconColor = getCategoryIconColor(item.category);

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      onSwipeableWillOpen={handleSwipeOpen}
      friction={2}
      rightThreshold={40}
      leftThreshold={40}
      enabled={!selectionMode}
    >
      <TouchableOpacity
        style={[
          styles.card,
          isSelected && styles.cardSelected,
        ]}
        onPress={() => selectionMode ? onPress(item.id) : null}
        onLongPress={() => !selectionMode && onLongPress(item.id)}
        activeOpacity={selectionMode ? 0.7 : 1}
        delayLongPress={400}
      >
        {selectionMode && (
          <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
          </View>
        )}

        <View style={[styles.iconCircle, { backgroundColor: `${iconColor}18` }]}>
          <Ionicons name={iconName as any} size={14} color={iconColor} />
        </View>

        <View style={styles.center}>
          <Text style={styles.desc} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={styles.category} numberOfLines={1}>
            {item.category}
          </Text>
        </View>

        <Text
          style={[
            styles.amount,
            isIncome ? styles.amountIn : styles.amountOut,
          ]}
        >
          {fmt(item.amount)}
        </Text>
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardSelected: {
    backgroundColor: Colors.accentLight,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1 },
  desc: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  category: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  amount: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.sm,
    textAlign: 'right',
    minWidth: 72,
  },
  amountIn: { color: Colors.accent },
  amountOut: { color: Colors.primary },

  deleteAction: {
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderTopRightRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
    gap: 2,
  },
  leftActions: {
    flexDirection: 'row',
  },
  editAction: {
    backgroundColor: Colors.warning,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
    gap: 2,
  },
  actionText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: '#FFF',
  },
});
