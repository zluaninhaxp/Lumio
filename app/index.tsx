import { Redirect } from 'expo-router';
import { useAppStore } from '@/src/store';
import { useAuth } from '@/src/hooks/useAuth';

export default function Index() {
  const { isAuthenticated, currentUser, loading, ready } = useAuth();
  const hasPendingReport = useAppStore((state) => !!state.pendingOnboardingExtraction);
  if (loading || !ready) return null;
  if (!isAuthenticated) return <Redirect href="/welcome" />;
  if (!currentUser?.onboardingCompleted) {
    return <Redirect href={hasPendingReport ? '/onboarding-summary' : '/onboarding'} />;
  }
  return <Redirect href="/(tabs)/chat" />;
}
