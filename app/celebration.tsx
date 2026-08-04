import { useEffect, useRef, useState } from 'react';
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
import { useAppStore } from '../src/store';
import { buildMockExtractionResult } from '../src/engine/openOnboardingEngine';
import { extractBusinessProfile } from '../src/ai/aiOnboardingService';
import CelebrationText from '@/app/components/CelebrationText';

const BG_COLOR = '#007F6A';

// Sequência de expressões do mascote enquanto "processa" as respostas:
// pensa -> concentra -> (ao concluir) sorri.
const THINKING_IMAGE = require('../assets/mascot-expressions/10_piscando.png');
const FOCUSED_IMAGE = require('../assets/mascot-expressions/12_focado.png');
const DONE_IMAGE = require('../assets/mascot-expressions/05_muito_feliz.png');

// Tempo mínimo (ms) que a animação de "pensando" fica visível antes de
// poder revelar o botão — mesmo que a extração (mock) resolva quase
// instantaneamente, isso evita um "pisca" na tela que pareceria bugado.
const MIN_THINKING_MS = 2200;

type Phase = 'thinking' | 'focused' | 'done';

export default function CelebrationScreen() {
  const router = useRouter();
  const openAnswers = useAppStore((s) => s.openAnswers);
  const onboardingContext = useAppStore((s) => s.onboardingContext);
  const setPendingOnboardingExtraction = useAppStore((s) => s.setPendingOnboardingExtraction);

  const [phase, setPhase] = useState<Phase>('thinking');
  const startedRef = useRef(false);

  const opacity = useSharedValue(0);
  const enterY = useSharedValue(200);
  const floatY = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) });
    enterY.value = withSequence(
      withTiming(200, { duration: 0 }),
      withTiming(0, { duration: 1000, easing: Easing.out(Easing.cubic) }),
    );
    floatY.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(-10, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
          withTiming(10, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      ),
    );
    textOpacity.value = withDelay(1200, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));

    return () => {
      cancelAnimation(opacity);
      cancelAnimation(enterY);
      cancelAnimation(floatY);
      cancelAnimation(textOpacity);
      cancelAnimation(buttonOpacity);
    };
  }, []);

  // "Pensa, concentra, e quando conclui, sorri": este é o momento em que a
  // IA (ver `aiOnboardingService.ts`) analisaria as respostas do
  // onboarding. Hoje `extractBusinessProfile` ainda não está implementado
  // (lança erro de propósito — ver comentário no arquivo), então caímos de
  // volta na heurística mock local, mas a estrutura já é a definitiva: só
  // trocar o que resolve a Promise não muda nada nas telas.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const startedAt = Date.now();

    const midway = setTimeout(() => setPhase('focused'), MIN_THINKING_MS / 2);

    (async () => {
      let result;
      try {
        if (!onboardingContext) throw new Error('onboardingContext ausente');
        result = await extractBusinessProfile(onboardingContext);
      } catch {
        result = buildMockExtractionResult(openAnswers);
      }

      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_THINKING_MS - elapsed);

      setTimeout(() => {
        setPendingOnboardingExtraction(result);
        setPhase('done');
        buttonOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
      }, remaining);
    })();

    return () => clearTimeout(midway);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: enterY.value + floatY.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));
  const buttonAnimatedStyle = useAnimatedStyle(() => ({ opacity: buttonOpacity.value }));

  const mascotImage = phase === 'thinking'
    ? THINKING_IMAGE
    : phase === 'focused'
      ? FOCUSED_IMAGE
      : DONE_IMAGE;

  const handleSeeResults = () => {
    router.replace('/onboarding-summary');
  };

  return (
    <View style={styles.container}>
      <Animated.Image
        source={mascotImage}
        style={[styles.mascot, animatedStyle]}
        resizeMode="contain"
      />

      <Animated.View style={[styles.textWrapper, textAnimatedStyle]}>
        {phase === 'done' ? (
          <Text style={styles.doneText}>Prontinho! Já entendi seu negócio.</Text>
        ) : (
          <CelebrationText phase={phase} />
        )}
      </Animated.View>

      {phase === 'done' && (
        <Animated.View style={[styles.buttonWrapper, buttonAnimatedStyle]}>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={handleSeeResults}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>Ver resultados</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
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
    paddingHorizontal: 32,
  },
  doneText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
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
