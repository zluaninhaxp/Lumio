import { useEffect } from 'react';
import { Image, StyleSheet, useWindowDimensions } from 'react-native';
import { Asset } from 'expo-asset';
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
import {
  onboardingMessageAssets,
  OnboardingMessageVariant,
} from '../../../src/data/onboardingMessageAssets';

interface Props {
  stage: number;
  variant: OnboardingMessageVariant;
  accessibilityLabel: string;
  delayMs?: number;
}

export default function LumioMessageAsset({ stage, variant, accessibilityLabel, delayMs = 0 }: Props) {
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const source = onboardingMessageAssets[stage]?.[variant];
  const image = source ? Asset.fromModule(source) : null;
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

  if (!source || !image) return null;
  const imageWidth = Math.min(width - 32, 300);
  return (
    <Animated.View
      style={[styles.imageContainer, { width: imageWidth, aspectRatio: image.width && image.height ? image.width / image.height : 3 / 2 }, animatedStyle]}
    >
      <Image
        source={source}
        resizeMode="contain"
        style={styles.image}
        accessible
        accessibilityLabel={accessibilityLabel.replace(/\*\*/g, '')}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  imageContainer: { alignSelf: 'center' },
  image: { width: '100%', height: '100%' },
});
