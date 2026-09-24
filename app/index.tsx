import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/src/store';
import { useAuth } from '@/src/hooks/useAuth';

const SHOW_DURATION = 2000;
const SPLASH_IMAGE = require('../assets/lumio-splash.png');

export default function Index() {
  const router = useRouter();
  const setHasSeenSplash = useAppStore((s) => s.setHasSeenSplash);
  const { isAuthenticated, currentUser, loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    setHasSeenSplash(true);
    const timer = setTimeout(() => setSplashDone(true), SHOW_DURATION);
    return () => clearTimeout(timer);
  }, [setHasSeenSplash]);

  useEffect(() => {
    if (!splashDone || loading) return;
    if (!isAuthenticated) router.replace('/welcome');
    else if (!currentUser?.onboardingCompleted) router.replace('/onboarding');
    else router.replace('/(tabs)/chat');
  }, [splashDone, loading, isAuthenticated, currentUser, router]);

  return <View style={styles.container}><StatusBar style="light" /><Image source={SPLASH_IMAGE} resizeMode="contain" style={styles.image} /></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00A878' },
  image: { width: '78%', height: '40%', maxWidth: 420, maxHeight: 420 },
});
