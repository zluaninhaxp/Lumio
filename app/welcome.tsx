import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Colors, FontSize, Spacing } from '@/src/constants/theme';

const WELCOME_IMAGE = require('../assets/welcome.png');
const LUMIO_LOGO = require('../assets/lumio.png');

export default function WelcomeScreen() {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableHeight = height - insets.top - insets.bottom;
  const layoutWidth = Math.min(width, 520);
  const heroMinHeight = Math.min(408, Math.max(320, layoutWidth + 30));
  const heroHeight = Math.min(560, Math.max(heroMinHeight, availableHeight * 0.55));
  const titleSize = Math.min(36, Math.max(30, layoutWidth * 0.082));
  const subtitleSize = Math.min(15, Math.max(13, layoutWidth * 0.036));
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
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.page, { minHeight: availableHeight }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.top, { height: heroHeight }]}>
          <View pointerEvents="none" style={styles.primaryShape} />
          <View pointerEvents="none" style={styles.secondaryShape} />
          <View style={styles.hero}>
            <Image source={LUMIO_LOGO} resizeMode="contain" style={styles.logo} />
            <View pointerEvents="none" style={styles.heroGlow} />
            <Animated.View style={[styles.artExitWrap, exitArtStyle]}><Image source={WELCOME_IMAGE} resizeMode="contain" style={styles.illustration} /></Animated.View>
          </View>
        </View>
        <Animated.View style={[styles.content, { paddingTop: Math.min(20, Math.max(16, layoutWidth * 0.05)) }, exitContentStyle]} pointerEvents={leaving ? 'none' : 'auto'}>
          <Text style={[styles.title, { fontSize: titleSize, lineHeight: Math.round(titleSize * 1.13) }]}>Seu negócio,{"\n"}mais leve.</Text>
          <Text style={[styles.subtitle, { fontSize: subtitleSize, lineHeight: Math.round(subtitleSize * 1.48) }]}>Organize sua rotina e cuide do que faz seu negócio acontecer.</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => openAuth('register')} activeOpacity={.85} accessibilityRole="button"><Text style={styles.primaryButtonText}>Começar agora</Text><Ionicons name="arrow-forward" size={19} color="#FFFFFF" /></TouchableOpacity>
            <TouchableOpacity style={styles.loginButton} onPress={() => openAuth('login')} activeOpacity={.7} accessibilityRole="button"><Text style={styles.loginText}>Já uso o Lumio</Text><Text style={styles.loginTextBold}>Entrar</Text></TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg }, scroll: { flex: 1 }, page: { flexGrow: 1, width: '100%', alignSelf: 'stretch', backgroundColor: Colors.bg }, top: { width: '100%' },
  primaryShape: { position: 'absolute', width: 620, height: 610, top: -250, left: -104, borderRadius: 260, backgroundColor: Colors.accentLight, transform: [{ rotate: '-9deg' }] }, secondaryShape: { position: 'absolute', width: 560, height: 370, top: 300, right: -210, borderTopLeftRadius: 250, borderBottomLeftRadius: 210, borderTopRightRadius: 170, borderBottomRightRadius: 290, backgroundColor: Colors.accentSoft, transform: [{ rotate: '-12deg' }] },
  hero: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, alignItems: 'center', justifyContent: 'space-between' }, logo: { width: 102, height: 30, alignSelf: 'flex-start', zIndex: 2 }, heroGlow: { position: 'absolute', width: 310, height: 270, borderRadius: 140, top: '30%', backgroundColor: Colors.accentGlow, opacity: .65, transform: [{ rotate: '-12deg' }] }, artExitWrap: { width: '100%', flex: 1, alignItems: 'center' }, illustration: { width: '100%', flex: 1, maxWidth: 430, maxHeight: 390, marginTop: 4, zIndex: 1 },
  content: { flexShrink: 0, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm }, title: { fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -.8, color: Colors.primary }, subtitle: { maxWidth: 340, marginTop: Spacing.md, fontFamily: 'PlusJakartaSans_400Regular', color: Colors.textSecondary },
  actions: { width: '100%', marginTop: Spacing.xl }, primaryButton: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: 18, backgroundColor: Colors.accent, shadowColor: Colors.accent, shadowOpacity: .16, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 }, primaryButtonText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: FontSize.md, color: '#FFFFFF' }, loginButton: { minHeight: 42, marginTop: Spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, loginText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: FontSize.sm, color: Colors.textSecondary }, loginTextBold: { fontFamily: 'PlusJakartaSans_700Bold', color: Colors.accent },
});
