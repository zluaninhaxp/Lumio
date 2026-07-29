import { useEffect, useRef } from 'react';
import { StyleSheet, ImageSourcePropType } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

interface MascotProps {
  image: ImageSourcePropType;
  /** Ativa um leve "respirar" contínuo enquanto o mascote está parado. */
  idle?: boolean;
  /** Ativa um pequeno "aceno" — usado quando o mascote acabou de falar. */
  bump?: boolean;
  size?: number;
}

/**
 * Mascote animado do onboarding.
 *
 * - Entrada suave (fade + slide) na primeira montagem.
 * - Cross-fade + leve "pulo" toda vez que a imagem (expressão) muda.
 * - Flutuação contínua sutil para não parecer uma imagem estática.
 */
export default function Mascot({ image, idle = true, bump = false, size = 220 }: MascotProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);
  const scale = useSharedValue(0.92);
  const floatY = useSharedValue(0);
  const prevImageRef = useRef(image);

  // Entrada inicial
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) });
    translateY.value = withTiming(0, { duration: 550, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flutuação contínua (respirar)
  useEffect(() => {
    if (!idle) return;
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(floatY);
  }, [idle, floatY]);

  // Troca de expressão: pequeno "pulo" de reação
  useEffect(() => {
    if (prevImageRef.current === image) return;
    prevImageRef.current = image;
    scale.value = withSequence(
      withTiming(0.9, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 220, easing: Easing.out(Easing.back(1.6)) }),
    );
  }, [image, scale]);

  // "Bump" manual — usado quando o mascote termina de falar
  useEffect(() => {
    if (!bump) return;
    scale.value = withSequence(
      withTiming(1.05, { duration: 140, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
    );
  }, [bump, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value + floatY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.Image
      source={image}
      resizeMode="contain"
      style={[styles.image, { width: size, height: size }, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    alignSelf: 'center',
  },
});
