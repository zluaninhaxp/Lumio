import { useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { CommonActions, useIsFocused } from '@react-navigation/native';
import { useAppStore } from '../src/store';
import { useAuth } from '../src/hooks/useAuth';
import { onboardingService } from '../src/services/onboardingService';
import type { OnboardingExtractionResult } from '../src/ai/types';
import ReportDetail from './components/onboarding/report-detail';
import { useForwardOnboarding } from '../src/hooks/use-forward-onboarding';

export default function OnboardingSummaryScreen() {
  const router = useRouter();
  useForwardOnboarding();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { currentUser, refreshUser } = useAuth();

  const extraction = useAppStore((s) => s.pendingOnboardingExtraction);
  const isSimulation = useAppStore((s) => s.pendingOnboardingExtractionIsSimulation);
  const openAnswers = useAppStore((s) => s.openAnswers);
  const onboardingContext = useAppStore((s) => s.onboardingContext);
  const applyOnboardingExtraction = useAppStore((s) => s.applyOnboardingExtraction);
  const activatedPlugins = useAppStore((s) => s.activatedPlugins);
  const setPluginActivation = useAppStore((s) => s.setPluginActivation);
  const setPendingOnboardingExtraction = useAppStore((s) => s.setPendingOnboardingExtraction);

  // Se a pessoa cair aqui sem ter passado pela celebração (ex: deep link,
  // refresh), não há o que resumir — volta pro início do onboarding. MAS
  // enquanto finalizamos (ver `handleFinish` abaixo) o store zera
  // `pendingOnboardingExtraction` e esse efeito dispararia de novo em
  // direto ao `/onboarding`, competindo com o redirect pro chat — daí o
  // flash da tela de onboarding antes do chat. O `finishingRef` bloqueia
  // o redirect errático durante a finalização.
  const finishingRef = useRef(false);
  useEffect(() => {
    if (isFocused && !extraction && !finishingRef.current) {
      router.replace('/onboarding');
    }
  }, [extraction, isFocused, router]);

  const handleFinish = useCallback(async () => {
    if (!extraction || finishingRef.current) return;
    finishingRef.current = true;
    try {
      if (!currentUser) throw new Error('Sessão indisponível');
      await onboardingService.completeOnboarding(
        currentUser.id, openAnswers, onboardingContext ?? undefined,
        extraction, activatedPlugins,
      );
      await refreshUser();
      applyOnboardingExtraction(extraction);
      navigation.dispatch(CommonActions.reset({
        index: 0,
        routes: [{ name: '(tabs)', params: { screen: 'chat' } }],
      }));
    } catch {
      finishingRef.current = false;
      Alert.alert('Não foi possível concluir', 'Suas respostas foram preservadas. Tente continuar novamente.');
    }
  }, [applyOnboardingExtraction, currentUser, extraction, onboardingContext, openAnswers, activatedPlugins, refreshUser, navigation]);

  if (!extraction) return null;
  return <><Stack.Screen options={{ gestureEnabled: false }} /><ReportDetail
    extraction={extraction}
    isSimulation={isSimulation}
    activatedPlugins={activatedPlugins}
    onFinish={handleFinish}
    onSave={async (next: OnboardingExtractionResult) => {
      if (!currentUser) throw new Error('Usuário não disponível');
      await onboardingService.saveStructuredProfile(currentUser.id, next);
      setPendingOnboardingExtraction(next, isSimulation);
    }}
    onPluginActivation={setPluginActivation}
    onConfigureAi={() => router.push('/ai-settings')}
  /></>;
}
