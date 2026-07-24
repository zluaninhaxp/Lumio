import { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import CelebrationText from '@/app/components/CelebrationText';

const BG_COLOR = '#007F6A';
const MASCOT_IMAGE = require('../assets/mascot-expressions/10_piscando.png');

export default function CelebrationScreen() {
  const router = useRouter();

  const opacity = useSharedValue(0);
  const enterY = useSharedValue(200);
  const floatY = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });

    enterY.value = withSequence(
      withTiming(200, { duration: 0 }),
      withTiming(0, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      }),
    );

    floatY.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
          withTiming(10, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );

    textOpacity.value = withDelay(
      1400,
      withTiming(1, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      }),
    );

    buttonOpacity.value = withDelay(
      2200,
      withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      }),
    );

    return () => {
      cancelAnimation(opacity);
      cancelAnimation(enterY);
      cancelAnimation(floatY);
      cancelAnimation(textOpacity);
      cancelAnimation(buttonOpacity);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: enterY.value + floatY.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  const handleContinue = () => {
    router.replace('/(tabs)/chat');
  };

  return (
    <View style={styles.container}>
      <Animated.Image
        source={MASCOT_IMAGE}
        style={[styles.mascot, animatedStyle]}
        resizeMode="contain"
      />

      <Animated.View style={[styles.textWrapper, textAnimatedStyle]}>
        <CelebrationText />
      </Animated.View>

      <Animated.View style={[styles.buttonWrapper, buttonAnimatedStyle]}>
        <TouchableOpacity
          style={styles.continueBtn}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>Continuar</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascot: {
    width: 180,
    height: 180,
  },
  textWrapper: {
    position: 'absolute',
    bottom: '30%',
    width: '100%',
    alignItems: 'center',
  },
  buttonWrapper: {
    position: 'absolute',
    bottom: '8%',
    width: '100%',
    alignItems: 'center',
  },
  continueBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  continueBtnText: {
    color: BG_COLOR,
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
