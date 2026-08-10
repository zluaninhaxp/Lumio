import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius } from '../../../src/constants/theme';

export function SkeletonLoader() {
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.row}>
          <View style={styles.avatar} />
          <View style={styles.lines}>
            <View style={[styles.line, styles.lineShort]} />
            <View style={styles.line} />
          </View>
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
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.border,
  },
  lines: { flex: 1, gap: Spacing.xs },
  line: {
    height: 12,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  lineShort: { width: '60%' },
});
