import { View, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '../../../src/constants/theme';

interface StageProgressProps {
  totalStages: number;
  currentStage: number; // 1-indexed
}

/** Barra de progresso por etapa — estilo trilha, não spinner de chat. */
export default function StageProgress({ totalStages, currentStage }: StageProgressProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: totalStages }).map((_, i) => (
        <View
          key={i}
          style={[styles.segment, i < currentStage && styles.segmentActive]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
  },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
  },
  segmentActive: {
    backgroundColor: Colors.accent,
  },
});
