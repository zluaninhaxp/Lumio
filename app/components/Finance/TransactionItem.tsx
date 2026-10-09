import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { ControlOpacity, Colors, Spacing, Radius, FontSize, SurfaceStyles } from '../../../src/constants/theme';
import { ChatIndicator } from '../ChatIndicator';
import { getCategoryIcon, getCategoryIconColor, getCategoryIconBackground } from '../../../src/hooks/useFinanceState';
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
  onMarkReceived?: (id: string) => void;
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
  onMarkReceived,
  onSwipeOpen,
}: TransactionItemProps) {
  const swipeableRef = useRef<Swipeable>(null);

  const handleSwipeOpen = useCallback(() => {
    onSwipeOpen(swipeableRef.current);
  }, [onSwipeOpen]);

  const renderRightActions = useCallback(
    () => {
      return (
        <TouchableOpacity activeOpacity={ControlOpacity.pressed}
          style={styles.deleteAction}
          accessibilityRole="button"
          accessibilityLabel="Excluir transação"
          onPress={() => {
            swipeableRef.current?.close();
            onDelete(item.id);
          }}
        >
          <Ionicons name="trash-outline" size={20} color={Colors.onAction} />
          <Text style={styles.actionText}>Excluir</Text>
        </TouchableOpacity>
      );
    },
    [item.id, onDelete]
  );

  const renderLeftActions = useCallback(
    () => {
      return (
        <TouchableOpacity activeOpacity={ControlOpacity.pressed}
          style={styles.editAction}
          accessibilityRole="button"
          accessibilityLabel="Editar transação"
          onPress={() => {
            swipeableRef.current?.close();
            onEdit(item);
          }}
        >
          <Ionicons name="create-outline" size={20} color={Colors.onAction} />
          <Text style={styles.actionText}>Editar</Text>
        </TouchableOpacity>
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
        activeOpacity={ControlOpacity.pressed}
        delayLongPress={400}
      >
        {selectionMode && (
          <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
            {isSelected && <Ionicons name="checkmark" size={14} color={Colors.onAction} />}
          </View>
        )}

        <View style={[styles.iconCircle, { backgroundColor: getCategoryIconBackground(item.category) }]}>
          <Ionicons name={iconName as any} size={14} color={iconColor} />
        </View>

        <View style={styles.center}>
          <View style={styles.descriptionRow}>
            {item.source === 'chat' && <ChatIndicator size={14} />}
            <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>
          </View>
          <Text style={styles.category} numberOfLines={1}>
           {item.category || 'Sem categoria'}{item.confirmed === false ? ' · Prevista' : ''}
          </Text>
          {item.confirmed === false && onMarkReceived && <TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={() => onMarkReceived(item.id)}><Text style={styles.receiveText}>Marcar recebida</Text></TouchableOpacity>}
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
      ...SurfaceStyles.card,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardSelected: {
    backgroundColor: Colors.accentLight,
    borderWidth: 1,
    borderColor: Colors.accentIcon,
  },
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: SurfaceStyles.filter.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleActive: {
    backgroundColor: Colors.actionBackground,
    borderColor: Colors.accentIcon,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1 },
  descriptionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
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
  receiveText: { color: Colors.accentText, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: FontSize.xs, marginTop: 2 },
  amount: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.sm,
    textAlign: 'right',
    minWidth: 72,
  },
  amountIn: { color: Colors.accentText },
  amountOut: { color: Colors.primary },

  deleteAction: {
    backgroundColor: Colors.dangerActionBackground,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderTopRightRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  editAction: {
    backgroundColor: Colors.warningActionBackground,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  actionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: Colors.onAction,
  },
});
