import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/store';
import ReportIntro from './components/onboarding/report-intro';

export default function OnboardingReportIntroScreen() {
  const router = useRouter();
  const extraction = useAppStore((state) => state.pendingOnboardingExtraction);
  const isSimulation = useAppStore((state) => state.pendingOnboardingExtractionIsSimulation);

  useEffect(() => {
    if (!extraction) router.replace('/onboarding');
  }, [extraction, router]);

  if (!extraction) return null;
  return <ReportIntro isSimulation={isSimulation} onBack={() => router.back()} onExplore={() => router.replace({ pathname: '/onboarding-summary', params: { view: 'full' } })} />;
}
