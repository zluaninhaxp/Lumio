import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

import { Spacing } from '../../../src/constants/theme';

const MASCOT_EXPRESSIONS: Record<number, any> = {
  1: require('../../../assets/mascot-expressions/11_sorriso_leve.png'),
  2: require('../../../assets/mascot-expressions/12_focado.png'),
  3: require('../../../assets/mascot-expressions/03_serio.png'),
  4: require('../../../assets/mascot-expressions/02_feliz.png'),
  5: require('../../../assets/mascot-expressions/05_muito_feliz.png'),
};

interface MascotViewProps {
  stage: number;
  size?: number;
}

export default function MascotView({ stage, size = 180 }: MascotViewProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);
  const floatY = useSharedValue(20);

  useEffect(() => {
    opacity.value = 0;
    scale.value = 0.6;
    floatY.value = 20;

    opacity.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.back(1.5)),
    });
    scale.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.back(1.5)),
    });
    floatY.value = withDelay(
      800,
      withSequence(
        withTiming(-6, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(6, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      ),
    );

    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      cancelAnimation(floatY);
    };
  }, [stage]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateY: floatY.value },
    ],
  }));

  const source = MASCOT_EXPRESSIONS[stage] ?? MASCOT_EXPRESSIONS[1];

  return (
    <View style={styles.container}>
      <Animated.Image
        source={source}
        style={[styles.image, { width: size, height: size }, animatedStyle]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  image: {
    width: 180,
    height: 180,
  },
});
