import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';

interface SelectionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onCategorize: (category: string) => void;
  onCancel: () => void;
  categoryOptions: string[];
}

export function SelectionBar({
  selectedCount,
  onDelete,
  onCategorize,
  onCancel,
  categoryOptions,
}: SelectionBarProps) {
  const [showCategories, setShowCategories] = useState(false);

  return (
    <View style={styles.wrapper}>
      {showCategories && (
        <View style={styles.categorySheet}>
          <Text style={styles.categoryTitle}>Categorizar como</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {categoryOptions.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={styles.categoryChip}
                onPress={() => {
                  onCategorize(cat);
                  setShowCategories(false);
                }}
              >
                <Text style={styles.categoryChipText}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      <View style={styles.bar}>
        <TouchableOpacity onPress={onCancel} style={styles.barBtn}>
          <Ionicons name="close" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.count}>
          {selectedCount} {selectedCount === 1 ? 'selecionada' : 'selecionadas'}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.barBtn}
            onPress={() => setShowCategories(!showCategories)}
          >
            <Ionicons name="pricetag-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
            <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  barBtn: {
    padding: Spacing.sm,
  },
  count: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  deleteBtn: {
    padding: Spacing.sm,
  },
  categorySheet: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  categoryTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  categoryRow: {
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentLight,
  },
  categoryChipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.accent,
  },
});
