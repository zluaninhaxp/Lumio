import { useEffect } from 'react';
import { StyleSheet, View, type ActivityIndicatorProps } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Colors } from '../constants/theme';

/** Shared indeterminate indicator; rotation runs on the UI thread, including while JS is busy. */
export function LoadingSpinner({ size = 'small', color = Colors.accentIcon, animating = true, hidesWhenStopped = true, style, accessibilityLabel = 'Carregando', ...props }: ActivityIndicatorProps) {
  const diameter = typeof size === 'number' ? size : size === 'large' ? 36 : 20;
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.set(0);
    if (animating) {
      // This is functional progress feedback, without translation, zoom or flashing.
      rotation.set(withRepeat(withTiming(360, { duration: 900, easing: Easing.linear, reduceMotion: ReduceMotion.Never }), -1, false, undefined, ReduceMotion.Never));
    }
    return () => cancelAnimation(rotation);
  }, [animating, rotation]);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));
  if (!animating && hidesWhenStopped) return null;
  const borderWidth = diameter >= 32 ? 3 : 2;
  return <View {...props} accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} accessibilityState={{ busy: animating }} style={[styles.container, style]}>
    <View style={{ width: diameter, height: diameter }}>
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: diameter / 2, borderWidth, borderColor: color, opacity: 0.2 }]} />
      <Animated.View accessible={false} style={[StyleSheet.absoluteFillObject, { borderRadius: diameter / 2, borderWidth, borderColor: 'transparent', borderTopColor: color, borderRightColor: color }, spinStyle]} />
    </View>
  </View>;
}

const styles = StyleSheet.create({ container: { alignItems: 'center', justifyContent: 'center' } });
