import { useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useAppStore } from '../src/store';
import { useForwardOnboarding } from '../src/hooks/use-forward-onboarding';
import ReportIntro from './components/onboarding/report-intro';

export default function OnboardingReportIntroScreen() {
  const router = useRouter();
  useForwardOnboarding();
  const isFocused = useIsFocused();
  const extraction = useAppStore((state) => state.pendingOnboardingExtraction);
  const isSimulation = useAppStore((state) => state.pendingOnboardingExtractionIsSimulation);

  useEffect(() => {
    if (isFocused && !extraction) router.replace('/onboarding');
  }, [extraction, isFocused, router]);

  if (!extraction) return null;
  return <><Stack.Screen options={{ gestureEnabled: false }} /><ReportIntro isSimulation={isSimulation} onExplore={() => router.replace({ pathname: '/onboarding-summary', params: { view: 'full' } })} /></>;
}
