import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter, Image, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Colors, FontSize, Spacing } from '@/src/constants/theme';

const WELCOME_IMAGE = require('../assets/welcome.png');
const LUMIO_LOGO = require('../assets/lumio.png');

export default function WelcomeScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const compact = height < 760;
  const heroHeight = Math.min(430, Math.max(340, height * 0.48));
  const [leaving, setLeaving] = useState(false);
  const exit = useSharedValue(0);
  useFocusEffect(useCallback(() => {
    setLeaving(false);
    exit.value = withTiming(0, { duration: 420, easing: Easing.inOut(Easing.cubic) });
  }, [exit]));
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('lumio-auth-closing', () => {
      setLeaving(false);
      exit.value = withTiming(0, { duration: 420, easing: Easing.inOut(Easing.cubic) });
    });
    return () => subscription.remove();
  }, [exit]);
  const exitArtStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value, transform: [{ translateY: exit.value * -70 }, { scale: 1 - exit.value * .18 }] }));
  const exitContentStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value, transform: [{ translateY: exit.value * 18 }] }));
  const openAuth = useCallback((mode: 'login' | 'register') => {
    if (leaving) return;
    setLeaving(true);
    exit.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    router.push(`/auth?mode=${mode}`);
  }, [exit, leaving, router]);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.page}>
        <View pointerEvents="none" style={styles.primaryShape} />
        <View pointerEvents="none" style={styles.secondaryShape} />
        <View style={[styles.hero, { height: heroHeight, flex: 0 }, compact && styles.heroCompact]}>
          <Image source={LUMIO_LOGO} resizeMode="contain" style={styles.logo} />
          <View pointerEvents="none" style={styles.heroGlow} />
          <Animated.View style={[styles.artExitWrap, exitArtStyle]}><Image source={WELCOME_IMAGE} resizeMode="contain" style={[styles.illustration, compact && styles.illustrationCompact]} /></Animated.View>
        </View>
        <Animated.View style={[styles.content, compact && styles.contentCompact, exitContentStyle]} pointerEvents={leaving ? 'none' : 'auto'}>
          <Text style={[styles.title, compact && styles.titleCompact]}>Seu negócio,{"\n"}mais leve.</Text>
          <Text style={styles.subtitle}>Organize sua rotina e cuide do que faz seu negócio acontecer.</Text>
          <View style={[styles.actions, compact && styles.actionsCompact]}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => openAuth('register')} activeOpacity={.85} accessibilityRole="button"><Text style={styles.primaryButtonText}>Começar agora</Text><Ionicons name="arrow-forward" size={19} color="#FFFFFF" /></TouchableOpacity>
            <TouchableOpacity style={styles.loginButton} onPress={() => openAuth('login')} activeOpacity={.7} accessibilityRole="button"><Text style={styles.loginText}>Já uso o Lumio</Text><Text style={styles.loginTextBold}>Entrar</Text></TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg }, page: { flex: 1, width: '100%', alignSelf: 'stretch', overflow: 'hidden', backgroundColor: Colors.bg },
  primaryShape: { position: 'absolute', width: 620, height: 610, top: -250, left: -104, borderRadius: 260, backgroundColor: Colors.accentLight, transform: [{ rotate: '-9deg' }] }, secondaryShape: { position: 'absolute', width: 560, height: 370, top: 300, right: -210, borderTopLeftRadius: 250, borderBottomLeftRadius: 210, borderTopRightRadius: 170, borderBottomRightRadius: 290, backgroundColor: Colors.accentSoft, transform: [{ rotate: '-12deg' }] },
  hero: { width: '100%', alignSelf: 'stretch', paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, alignItems: 'center', justifyContent: 'space-between' }, logo: { width: 102, height: 30, alignSelf: 'flex-start', zIndex: 2 }, heroGlow: { position: 'absolute', width: 310, height: 270, borderRadius: 140, top: '30%', backgroundColor: Colors.accentGlow, opacity: .65, transform: [{ rotate: '-12deg' }] }, artExitWrap: { width: '100%', flex: 1, alignItems: 'center' }, illustration: { width: '100%', flex: 1, maxWidth: 430, maxHeight: 390, marginTop: 4, zIndex: 1 },
  heroCompact: { height: 340, paddingTop: Spacing.md }, illustrationCompact: { maxHeight: 280, marginTop: -4 },
  content: { flex: 1, width: '100%', alignSelf: 'stretch', justifyContent: 'flex-start', paddingHorizontal: Spacing.xl, paddingTop: 38, paddingBottom: Spacing.sm }, title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 38, lineHeight: 43, letterSpacing: -.8, color: Colors.primary }, subtitle: { maxWidth: 340, marginTop: Spacing.md, fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.md, lineHeight: 22, color: Colors.textSecondary },
  contentCompact: { flex: 0.52, paddingTop: 20 }, titleCompact: { fontSize: 32, lineHeight: 36 }, actions: { width: '100%', marginTop: Spacing.xxxl }, actionsCompact: { marginTop: Spacing.lg }, primaryButton: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: 18, backgroundColor: Colors.accent, shadowColor: Colors.accent, shadowOpacity: .16, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 }, primaryButtonText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.md, color: '#FFFFFF' }, loginButton: { minHeight: 40, marginTop: Spacing.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, loginText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.sm, color: Colors.textSecondary }, loginTextBold: { fontFamily: 'PlusJakartaSans_700Bold', color: Colors.accent },
});
