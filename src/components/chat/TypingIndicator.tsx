import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { Colors, Spacing } from '../../constants/theme';

function TypingDot({ index, progress, reducedMotion }: { index: number; progress: SharedValue<number>; reducedMotion: boolean }) {
  const animation = useAnimatedStyle(() => {
    const pulse = (Math.sin(progress.get() * Math.PI * 2 - index * Math.PI * 2 / 3) + 1) / 2;
    return { opacity: reducedMotion ? 0.6 : 0.35 + pulse * 0.65, transform: [{ translateY: reducedMotion ? 0 : -2 * pulse }] };
  });
  return <Animated.View style={[styles.dot, animation]} />;
}

/** Transient response feedback; never part of the persisted conversation. */
export function TypingIndicator() {
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!reducedMotion) progress.set(withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(progress);
  }, [progress, reducedMotion]);
  return <View accessible accessibilityLabel="Lumio está digitando" accessibilityLiveRegion="polite" style={styles.dots}>
    {[0, 1, 2].map(index => <TypingDot key={index} index={index} progress={progress} reducedMotion={reducedMotion} />)}
  </View>;
}

const styles = StyleSheet.create({
  dots: { height: 22, minWidth: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textSecondary },
});
