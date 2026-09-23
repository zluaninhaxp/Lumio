import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/src/store';
import { useAuth } from '@/src/hooks/useAuth';
import { Colors, FontSize, Radius, Spacing } from '@/src/constants/theme';

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
  }, [setHasSeenSplash]);

  useEffect(() => {
    if (!splashDone || loading) return;
    if (!isAuthenticated) router.replace('/welcome');
    else if (!currentUser?.onboardingCompleted) router.replace('/onboarding');
    else router.replace('/(tabs)/chat');
  }, [splashDone, loading, isAuthenticated, currentUser, router]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.orbLarge} />
      <View style={styles.orbOutline} />
      <View style={styles.content}>
        <View style={styles.brandMark}><Ionicons name="sparkles" size={34} color={Colors.accent} /></View>
        <Text style={styles.title}>Lumio</Text>
        <Text style={styles.subtitle}>Clareza para o que importa.</Text>
      </View>
      <View style={styles.footer}>
        <View style={styles.loadingTrack}><View style={styles.loadingFill} /></View>
        <Text style={styles.loadingText}>Preparando seu espaço</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: Colors.accent },
  content: { alignItems: 'center', zIndex: 1 },
  brandMark: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgCard, shadowColor: '#006B4C', shadowOffset: { width: 0, height: 12 }, shadowOpacity: .2, shadowRadius: 24, elevation: 5 },
  title: { marginTop: Spacing.lg, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: FontSize.display, letterSpacing: 1, color: '#FFFFFF' },
  subtitle: { marginTop: Spacing.xs, fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.md, color: '#D9F4EC' },
  orbLarge: { position: 'absolute', width: 360, height: 360, borderRadius: Radius.full, left: -180, top: -128, backgroundColor: '#35B993', opacity: .6 },
  orbOutline: { position: 'absolute', width: 240, height: 240, borderRadius: Radius.full, right: -120, bottom: 84, borderWidth: 1, borderColor: '#91DCC6', opacity: .6 },
  footer: { position: 'absolute', right: Spacing.xxxl, bottom: 48, left: Spacing.xxxl, alignItems: 'center' },
  loadingTrack: { width: 72, height: 4, overflow: 'hidden', borderRadius: Radius.full, backgroundColor: '#6BCBAD' },
  loadingFill: { width: 42, height: 4, borderRadius: Radius.full, backgroundColor: '#FFFFFF' },
  loadingText: { marginTop: Spacing.sm, fontFamily: 'PlusJakartaSans_500Medium', fontSize: FontSize.xs, color: '#D9F4EC' },
});
