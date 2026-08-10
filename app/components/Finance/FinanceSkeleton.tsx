import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius } from '../../../src/constants/theme';

export function FinanceSkeleton() {
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={styles.row}>
          <View style={styles.dateBar} />
          <View style={styles.content}>
            <View style={[styles.line, styles.lineShort]} />
            <View style={[styles.line, styles.lineTiny]} />
          </View>
          <View style={styles.amountBar} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  dateBar: {
    width: 28,
    height: 14,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
  line: {
    height: 12,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  lineShort: { width: '65%' },
  lineTiny: { width: '35%' },
  amountBar: {
    width: 64,
    height: 14,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
});
