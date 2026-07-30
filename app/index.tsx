import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/src/store';
import { useAuth } from '@/src/hooks/useAuth';

const BG_COLOR = '#007F6A';
const SHOW_DURATION = 2000;

export default function Index() {
  const router = useRouter();
  const setHasSeenSplash = useAppStore((s) => s.setHasSeenSplash);
  const { isAuthenticated, currentUser, loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    setHasSeenSplash(true);
    const timer = setTimeout(() => setSplashDone(true), SHOW_DURATION);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Só decide para onde navegar depois que a splash mínima terminou E a
    // sessão salva (se existir) já foi carregada do AsyncStorage.
    if (!splashDone || loading) return;

    if (!isAuthenticated) {
      router.replace('/login');
    } else if (!currentUser?.onboardingCompleted) {
      router.replace('/onboarding');
    } else {
      router.replace('/(tabs)/chat');
    }
  }, [splashDone, loading, isAuthenticated, currentUser, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lumio</Text>
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
  title: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 48,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
});
