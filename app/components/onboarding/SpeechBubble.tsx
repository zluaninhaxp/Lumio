import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';

interface SpeechBubbleProps {
  text: string;
  animationKey: string;
}

function parseBold(text: string): { text: string; bold: boolean }[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return { text: part.slice(2, -2), bold: true };
    }
    return { text: part, bold: false };
  }).filter((seg) => seg.text.length > 0);
}

export default function SpeechBubble({ text, animationKey }: SpeechBubbleProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    opacity.value = 0;
    translateY.value = 10;
    opacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
    translateY.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [animationKey, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const segments = useMemo(() => parseBold(text), [text]);

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <View style={styles.tail} />
      <View style={styles.bubble}>
        <Text style={styles.text}>
          {segments.map((seg, i) => (
            <Text key={i} style={seg.bold ? styles.bold : null}>
              {seg.text}
            </Text>
          ))}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  tail: {
    width: 18,
    height: 18,
    backgroundColor: Colors.bgCard,
    transform: [{ rotate: '45deg' }],
    marginBottom: -9,
    borderTopLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  bubble: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  text: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.lg,
    color: Colors.primary,
    lineHeight: 26,
    textAlign: 'center',
  },
  bold: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: Colors.accent,
  },
});
