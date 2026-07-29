import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { Colors, Spacing, FontSize, Radius } from '../../../src/constants/theme';

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
}

export default function ProgressBar({ current, total, label }: ProgressBarProps) {
  const segments = Array.from({ length: total });

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Conhecendo você</Text>
        {label ? (
          <Text style={styles.stageLabel}>{label}</Text>
        ) : (
          <Text style={styles.stageLabel}>
            Etapa {Math.min(current, total)} de {total}
          </Text>
        )}
      </View>
      <View style={styles.bar}>
        {segments.map((_, i) => {
          const isActive = i < current;
          const isCurrent = i === current - 1;
          return (
            <AnimatedSegment
              key={i}
              isActive={isActive}
              isCurrent={isCurrent}
            />
          );
        })}
      </View>
    </View>
  );
}

function AnimatedSegment({
  isActive,
  isCurrent,
}: {
  isActive: boolean;
  isCurrent: boolean;
}) {
  const width = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const w = isActive ? withTiming(1, { duration: 500 }) : withTiming(0, { duration: 300 });
    return {
      flex: w,
      backgroundColor: isCurrent ? Colors.accent : isActive ? Colors.accentLight : Colors.border,
    };
  });

  return (
    <Animated.View style={[styles.segment, animatedStyle]} />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.bg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.lg,
    color: Colors.primary,
  },
  stageLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  bar: {
    flexDirection: 'row',
    gap: Spacing.xs,
    height: 4,
  },
  segment: {
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
  },
});
