import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  extractBusinessProfile,
  AIProviderError,
  MissingApiKeyError,
} from '../src/ai/aiOnboardingService';
import { OnboardingExtractionResult } from '../src/ai/types';
import CelebrationText from '@/app/components/CelebrationText';

const BG_COLOR = '#007F6A';

// Sequência de expressões do mascote enquanto "processa" as respostas:
// pensa -> concentra -> (ao concluir) sorri.
const THINKING_IMAGE = require('../assets/mascot-expressions/10_piscando.png');
const FOCUSED_IMAGE = require('../assets/mascot-expressions/12_focado.png');
const DONE_IMAGE = require('../assets/mascot-expressions/05_muito_feliz.png');
const ERROR_IMAGE = require('../assets/mascot-expressions/04_confuso.png');

// Tempo mínimo (ms) que a animação de "pensando" fica visível antes de
// poder revelar o botão — mesmo que a extração resolva quase
// instantaneamente, isso evita um "pisca" na tela que pareceria bugado.
const MIN_THINKING_MS = 2200;

type Phase = 'thinking' | 'focused' | 'done' | 'error';

export default function CelebrationScreen() {
  const router = useRouter();
  const openAnswers = useAppStore((s) => s.openAnswers);
  const onboardingContext = useAppStore((s) => s.onboardingContext);
  const setPendingOnboardingExtraction = useAppStore((s) => s.setPendingOnboardingExtraction);

  const [phase, setPhase] = useState<Phase>('thinking');
  const [error, setError] = useState<{ message: string; kind: string } | null>(null);
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

  /**
   * Aplica o resultado (real ou simulado) respeitando o tempo mínimo de
   * "pensando" — só então vira 'done' e revela o botão de ver resultados.
   * O flag `isSimulation` avisa a tela de resumo para exibir o banner de
   * aviso apropriado (instrução 3.2).
   */
  const applyResult = useCallback(
    (result: OnboardingExtractionResult, isSimulation: boolean, startedAt: number) => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_THINKING_MS - elapsed);
      setTimeout(() => {
        setPendingOnboardingExtraction(result, isSimulation);
        setPhase('done');
        buttonOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
      }, remaining);
    },
    [setPendingOnboardingExtraction, buttonOpacity],
  );

  /**
   * Caminho de fallback explícito: a heurística mock local (sem IA) segue
   * existindo no projeto (instrução 3.2 — não apagar). É usada só quando:
   *  (a) o usuário ainda não cadastrou nenhuma chave e escolhe ver a
   *      simulação mesmo assim; ou
   *  (b) a chamada real falhou e o usuário optou por continuar com a
   *      versão simulada em vez de tentar de novo.
   * Em ambos os casos `isSimulation=true` liga o aviso na tela de resumo.
   */
  const useSimulationFallback = useCallback(
    () => {
      const startedAt = Date.now();
      const mockResult = buildMockExtractionResult(openAnswers);
      applyResult(mockResult, true, startedAt);
    },
    [openAnswers, applyResult],
  );

  /**
   * Executa a extração real (chamada direta ao Gemini com a chave do
   * usuário). Se não houver chave cadastrada (ou o aparelho não suportar
   * armazenamento seguro), NÃO interrompe o fluxo com tela de erro —
   * passa direto pra simulação com aviso, porque IA é opcional e o
   * usuário não deveria ser obrigado a configurar nada antes de
   * concluir o onboarding. O banner de "Relatório simulado" na tela de
   * resumo é que aponta para a tela de configurações.
   *
   * Em erros REAIS (chave inválida, 429, rede, formato) entra em 'error'
   * com "Tentar novamente" / "Continuar com simulação".
   */
  const runExtraction = useCallback(() => {
    startedRef.current = true;
    setPhase('thinking');
    setError(null);

    const midway = setTimeout(() => setPhase('focused'), MIN_THINKING_MS / 2);
    const startedAt = Date.now();

    (async () => {
      try {
        if (!onboardingContext) throw new AIProviderError('invalid-input');
        const result = await extractBusinessProfile(onboardingContext);
        applyResult(result, false, startedAt);
      } catch (e) {
        clearTimeout(midway);

        // Sem chave cadastrada (ou secure storage indisponível) → segue
        // direto pra simulação, sem parar o usuário. O banner no resumo
        // já oferece o caminho de configurar a chave.
        if (e instanceof MissingApiKeyError) {
          useSimulationFallback();
          return;
        }

        // Erro ao ler a chave do dispositivo (secure storage falhou fora
        // do caso comum de "indisponível") também não trava o fluxo —
        // deixa a simulação rodar, mas avisa.
        if (e instanceof AIProviderError && e.kind === 'provider') {
          useSimulationFallback();
          return;
        }

        if (e instanceof AIProviderError) {
          setPhase('error');
          setError({ message: e.message, kind: e.kind });
          buttonOpacity.value = withTiming(1, { duration: 300 });
          return;
        }
        setPhase('error');
        setError({ message: 'A IA retornou um erro. Tente novamente em instantes.', kind: 'provider' });
        buttonOpacity.value = withTiming(1, { duration: 300 });
      }
    })();

    return () => clearTimeout(midway);
  }, [onboardingContext, applyResult, useSimulationFallback, buttonOpacity]);

  // Dispara a extração real assim que a tela monta — o fluxo antigo caía
  // no mock por depender de uma função que lançava erro; agora a IA é
  // chamada de verdade, e o mock só aparece como fallback explícito.
  useEffect(() => {
    if (startedRef.current) return;
    const cleanup = runExtraction();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = useCallback(() => {
    startedRef.current = false;
    runExtraction();
  }, [runExtraction]);

  const handleGoToSettings = useCallback(() => {
    router.push('/ai-settings');
  }, [router]);

  const handleSeeResults = useCallback(() => {
    router.replace('/onboarding-summary');
  }, [router]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: enterY.value + floatY.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));
  const buttonAnimatedStyle = useAnimatedStyle(() => ({ opacity: buttonOpacity.value }));

  const mascotImage =
    phase === 'thinking'
      ? THINKING_IMAGE
      : phase === 'focused'
        ? FOCUSED_IMAGE
        : phase === 'error'
          ? ERROR_IMAGE
          : DONE_IMAGE;

  // Estado de erro: só oferece "Configurar minha chave" quando o erro for de
  // chave (inválida/recusada). Sem chave configurada hoje passa direto pra
  // simulação, então não há tela de erro para esse caso.
  const showSettingsButton = error?.kind === 'unauthorized';

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
        ) : phase === 'error' ? (
          <View>
            <Text style={styles.errorTitle}>Não consegui gerar agora</Text>
            <Text style={styles.errorText}>{error?.message ?? ''}</Text>
            <Text style={styles.errorHint}>
              Você pode tentar de novo, ou seguir com um relatório simulado
              e configurar sua chave grátis do Google AI Studio depois.
            </Text>
          </View>
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

      {phase === 'error' && (
        <Animated.View style={[styles.buttonWrapper, buttonAnimatedStyle]}>
          <View style={styles.errorActions}>
            {showSettingsButton && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={handleGoToSettings}
                activeOpacity={0.85}
              >
                <Text style={styles.actionBtnPrimaryText}>Configurar minha chave</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnGhost]}
              onPress={handleRetry}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnGhostText}>Tentar novamente</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSubtle]}
              onPress={useSimulationFallback}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnSubtleText}>Continuar com simulação</Text>
            </TouchableOpacity>
          </View>
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
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.95,
  },
  errorHint: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 10,
    opacity: 0.85,
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
  errorActions: {
    width: '100%',
    paddingHorizontal: 32,
    gap: 10,
  },
  actionBtn: {
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimary: { backgroundColor: '#FFFFFF' },
  actionBtnPrimaryText: {
    color: BG_COLOR,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  actionBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  actionBtnGhostText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  actionBtnSubtle: {},
  actionBtnSubtleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    opacity: 0.9,
    textDecorationLine: 'underline',
  },
});