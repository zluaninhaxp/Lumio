import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LumioSurfaceFill } from '../../../src/components/lumio-surface-fill';
import { Colors, Typography } from '../../../src/constants/theme';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { OnboardingMessage } from '../../../src/data/onboarding-messages';

interface Props {
  message: OnboardingMessage;
  delayMs?: number;
}

export default function LumioSpeechBubble({ message, delayMs = 0 }: Props) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(reducedMotion ? 1 : 0.9);
  const translateY = useSharedValue(reducedMotion ? 0 : 8);

  useEffect(() => {
    opacity.value = withDelay(delayMs, withTiming(1, { duration: reducedMotion ? 180 : 220 }));
    if (!reducedMotion) {
      const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
      scale.value = withDelay(delayMs, withSequence(
        withTiming(1.025, { duration: 190, easing: easeOut }),
        withTiming(1, { duration: 130, easing: easeOut }),
      ));
      translateY.value = withDelay(delayMs, withTiming(0, { duration: 300, easing: easeOut }));
    } else {
      scale.value = 1;
      translateY.value = 0;
    }
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      cancelAnimation(translateY);
    };
  }, [delayMs, opacity, reducedMotion, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[styles.container, animatedStyle]}
    >
      <View style={styles.body}>
        <LumioSurfaceFill />
        <View pointerEvents="none" style={styles.tail} />
        <Text
          style={styles.text}
          accessible
          accessibilityLabel={message.segments.map(segment => segment.text).join('')}
        >
          {message.segments.map((segment, index) => (
            <Text key={index} style={segment.emphasis ? styles.emphasis : undefined}>{segment.text}</Text>
          ))}
        </Text>
      </View>
      <Image
        source={message.mascot}
        resizeMode="contain"
        style={styles.mascot}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Center the complete composition, including only the 36px mascot overhang.
  // The remaining 52px of the mascot still overlap the body; there is no image column.
  container: { width: '100%', maxWidth: 376, alignSelf: 'center', paddingTop: 16, paddingLeft: 36 },
  body: {
    backgroundColor: Colors.bgCard, borderRadius: 22, borderWidth: 1,
    borderColor: '#8AD8BC', paddingLeft: 56, paddingRight: 16, paddingVertical: 13,
    boxShadow: '0 2px 4px rgba(36, 127, 99, 0.08)',
  },
  fill: { ...StyleSheet.absoluteFillObject, borderRadius: 21 },
  tail: {
    position: 'absolute', left: -6, top: 20, width: 12, height: 12,
    backgroundColor: Colors.bgCard, borderLeftWidth: 1, borderBottomWidth: 1,
    borderColor: '#8AD8BC', transform: [{ rotate: '45deg' }],
  },
  text: { fontFamily: Typography.medium, fontSize: 14, lineHeight: 20, color: Colors.primary },
  emphasis: { fontFamily: Typography.bold, color: Colors.accentText },
  // Source images include transparent margins. Contain preserves those and the aspect ratio.
  mascot: { position: 'absolute', left: 0, top: -2, width: 88, height: 80 },
});
