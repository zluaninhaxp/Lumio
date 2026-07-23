import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/src/store';
import SplashMedia from '@/app/components/SplashMedia';

export default function SplashIndex() {
  const router = useRouter();
  const hasNavigated = useRef(false);
  const hasSeenSplash = useAppStore((s) => s.hasSeenSplash);
  const setHasSeenSplash = useAppStore((s) => s.setHasSeenSplash);
  const onboardingCompleted = useAppStore((s) => s.onboardingCompleted);

  useEffect(() => {
    if (hasSeenSplash && !hasNavigated.current) {
      hasNavigated.current = true;
      if (onboardingCompleted) {
        router.replace('/(tabs)/chat');
      } else {
        router.replace('/onboarding');
      }
    }
  }, [hasSeenSplash, onboardingCompleted]);

  if (hasSeenSplash) return null;

  const handleEnd = () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    setHasSeenSplash(true);
    if (onboardingCompleted) {
      router.replace('/(tabs)/chat');
    } else {
      router.replace('/onboarding');
    }
  };

  return (
    <View style={styles.container}>
      <SplashMedia onEnd={handleEnd} bgColor="#007F6A" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#007F6A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
