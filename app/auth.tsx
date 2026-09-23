import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Colors, Radius, Spacing } from '@/src/constants/theme';
import { useAuth } from '@/src/hooks/useAuth';

const LOGO = require('../assets/lumio.png');
type Mode = 'login' | 'register';

export default function AuthScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [active, setActive] = useState<Mode>(mode === 'login' ? 'login' : 'register');
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}><StatusBar style="dark" /><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={s.page}>
    <View pointerEvents="none" style={s.shapeA} /><View pointerEvents="none" style={s.shapeB} />
    <View style={s.hero}><Image source={LOGO} resizeMode="contain" style={s.logo} /></View>
    <View style={s.panel}><TouchableOpacity style={s.back} onPress={() => router.back()} activeOpacity={.7}><Ionicons name="arrow-down" size={19} color={Colors.primary} /></TouchableOpacity>
      <View style={s.panelHead}><Text style={s.panelTitle}>{active === 'register' ? 'Vamos começar?' : 'Bem-vindo de volta'}</Text><View style={s.tabs}><Tab label="Entrar" active={active === 'login'} onPress={() => setActive('login')} /><Tab label="Criar conta" active={active === 'register'} onPress={() => setActive('register')} /></View></View>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}><Animated.View key={active} entering={FadeInRight.duration(220)}>{active === 'login' ? <Login done={(v) => router.replace(v ? '/(tabs)/chat' : '/onboarding')} /> : <Register done={() => router.replace('/onboarding')} />}</Animated.View></ScrollView>
    </View>
  </View></KeyboardAvoidingView></SafeAreaView>;
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <TouchableOpacity style={[s.tab, active && s.tabActive]} onPress={onPress}><Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text></TouchableOpacity>; }
function Login({ done }: { done: (complete: boolean) => void }) {
  const { login } = useAuth(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = useCallback(async () => { if (busy) return; setError(''); setBusy(true); try { const user = await login(email, password); done(user.onboardingCompleted); } catch (e: any) { setError(e?.message ?? 'Não foi possível entrar. Tente novamente.'); } finally { setBusy(false); } }, [busy, done, email, login, password]);
  return <View><Text style={s.hint}>Use seus dados para continuar.</Text>{error ? <Text style={s.error}>{error}</Text> : null}<Field label="E-mail" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="voce@email.com" autoCapitalize="none" keyboardType="email-address" /><Field label="Senha" icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry onSubmitEditing={submit} /><Submit label="Entrar" busy={busy} onPress={submit} /></View>;
}
function Register({ done }: { done: () => void }) {
  const { register } = useAuth(); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = useCallback(async () => { if (busy) return; setError(''); if (password !== confirm) { setError('As senhas não coincidem.'); return; } setBusy(true); try { await register(name, email, password); done(); } catch (e: any) { setError(e?.message ?? 'Não foi possível criar sua conta. Tente novamente.'); } finally { setBusy(false); } }, [busy, confirm, done, email, name, password, register]);
  return <View><Text style={s.hint}>Leva menos de um minuto.</Text>{error ? <Text style={s.error}>{error}</Text> : null}<Field label="Nome" icon="person-outline" value={name} onChangeText={setName} placeholder="Seu nome" /><Field label="E-mail" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="voce@email.com" autoCapitalize="none" keyboardType="email-address" /><Field label="Senha" icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="Mínimo de 6 caracteres" secureTextEntry /><Field label="Confirmar senha" icon="shield-checkmark-outline" value={confirm} onChangeText={setConfirm} placeholder="Repita a senha" secureTextEntry onSubmitEditing={submit} /><Submit label="Criar conta" busy={busy} onPress={submit} /></View>;
}
function Field({ label, icon, ...props }: any) { const [focus, setFocus] = useState(false); return <View style={s.field}><Text style={s.label}>{label}</Text><View style={[s.inputWrap, focus && s.inputFocus]}><Ionicons name={icon} size={18} color={focus ? Colors.accent : '#9AA8A2'} /><TextInput style={s.input} placeholderTextColor="#9AA8A2" accessibilityLabel={label} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} {...props} /></View></View>; }
function Submit({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) { return <TouchableOpacity style={[s.cta, busy && s.disabled]} onPress={onPress} disabled={busy}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={s.ctaText}>{label}</Text><Ionicons name="arrow-forward" size={19} color="#FFFFFF" /></>}</TouchableOpacity>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FCFA' }, flex: { flex: 1 }, page: { flex: 1, overflow: 'hidden', backgroundColor: '#F8FCFA' },
  shapeA: { position: 'absolute', width: 600, height: 500, top: -270, left: -130, borderRadius: 250, backgroundColor: '#E6F7F1', transform: [{ rotate: '-9deg' }] }, shapeB: { position: 'absolute', width: 520, height: 350, top: 140, right: -240, borderTopLeftRadius: 240, borderBottomLeftRadius: 200, borderTopRightRadius: 140, borderBottomRightRadius: 260, backgroundColor: '#F0FAF6', transform: [{ rotate: '-12deg' }] },
  hero: { height: 154, paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg }, logo: { width: 102, height: 30 },
  panel: { flex: 1, minHeight: 460, paddingTop: 18, borderTopLeftRadius: 34, borderTopRightRadius: 34, overflow: 'hidden', backgroundColor: '#FCFEFD', shadowColor: '#0B6B52', shadowOpacity: .08, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 8 }, back: { position: 'absolute', top: 12, right: Spacing.xl, width: 38, height: 38, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0FAF6', zIndex: 2 },
  panelHead: { paddingHorizontal: Spacing.xl, paddingRight: 72 }, panelTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: Colors.primary }, tabs: { height: 44, marginTop: Spacing.lg, marginRight: -52, padding: 4, flexDirection: 'row', borderRadius: Radius.lg, backgroundColor: '#EAF8F3' }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, tabActive: { backgroundColor: '#FFFFFF', elevation: 1 }, tabText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: Colors.textSecondary }, tabTextActive: { color: Colors.accent },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.xxxl }, hint: { marginBottom: 2, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: Colors.textSecondary }, error: { marginTop: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, color: Colors.danger, backgroundColor: Colors.dangerLight },
  field: { marginTop: Spacing.md }, label: { marginBottom: 7, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: Colors.primary }, inputWrap: { height: 56, paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, borderColor: '#DFE9E4', backgroundColor: '#FFFFFF' }, inputFocus: { borderColor: Colors.accent }, input: { flex: 1, height: '100%', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: Colors.primary },
  cta: { height: 56, marginTop: Spacing.xxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: 18, backgroundColor: Colors.accent }, ctaText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#FFFFFF' }, disabled: { opacity: .7 },
});
