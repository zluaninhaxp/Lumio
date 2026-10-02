import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, findNodeHandle, Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions, type TextInputProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Colors, Radius, Spacing } from '@/src/constants/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { ReportBackdrop } from '@/app/components/onboarding/report-processing';
// Replace this source to change the mascot without changing the layout.
const INPUT_MIN_HEIGHT = 56;
const AUTH_IMAGE = require('../../assets/login-Lumio.png');
type Mode = 'login' | 'register';
const FocusedFieldContext = createContext<(input: TextInput | null) => void>(() => { });
export default function AuthScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const focusedInput = useRef<TextInput | null>(null);
  const revealInput = useCallback(() => {
    const handle = findNodeHandle(focusedInput.current);
    if (handle) scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(handle, INPUT_MIN_HEIGHT + Spacing.lg, true);
  }, []);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', revealInput);
    const hide = Keyboard.addListener('keyboardDidHide', () => scrollRef.current?.scrollTo({ y: 0, animated: false }));
    return () => { show.remove(); hide.remove(); };
  }, [revealInput]);
  const heroSize = Math.min(width * .58, (height - insets.top - insets.bottom) * (mode === 'register' ? .22 : .29), mode === 'register' ? 190 : 240);
  const goBack = () => { Keyboard.dismiss(); if (router.canGoBack()) router.back(); else router.replace('/welcome'); };
  const switchMode = () => { Keyboard.dismiss(); router.replace(mode === 'login' ? '/register' : '/login'); };
  return <SafeAreaView style={s.safe} edges={['top', 'bottom', 'left', 'right']}><StatusBar style="dark" />
    <View pointerEvents="none" style={s.backdrop}><ReportBackdrop /></View>
    {/* Explicit avoidance also supports Expo Go hosts that do not apply app.json resize. */}
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView ref={scrollRef} onLayout={() => { if (Keyboard.isVisible()) revealInput(); }} style={s.flex} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.back} onPress={goBack} activeOpacity={.7} accessibilityRole="button" accessibilityLabel="Voltar à Welcome"><Ionicons name="chevron-back" size={26} color="#087E68" /></TouchableOpacity>
        <Image source={AUTH_IMAGE} resizeMode="contain" style={[s.hero, { width: heroSize, height: heroSize }]} accessible={false} />
        <View style={s.copy}><Text style={s.title}>{mode === 'login' ? 'Bem-vindo de volta' : 'Vamos começar?'}</Text><Text style={s.subtitle}>{mode === 'login' ? 'Que bom te ver por aqui!' : 'Leva menos de um minuto.'}</Text></View>
        <FocusedFieldContext.Provider value={(input) => { focusedInput.current = input; revealInput(); }}>{mode === 'login' ? <Login done={(complete) => router.replace(complete ? '/(tabs)/chat' : '/onboarding')} /> : <Register done={() => router.replace('/onboarding')} />}</FocusedFieldContext.Provider>
        <TouchableOpacity style={s.switchMode} onPress={switchMode} accessibilityRole="link" activeOpacity={.7}><Text style={s.switchText}>{mode === 'login' ? 'Ainda não tem uma conta?  ' : 'Já tem uma conta?  '}<Text style={s.switchLink}>{mode === 'login' ? 'Criar conta' : 'Entrar'}</Text></Text></TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
function Login({ done }: { done: (complete: boolean) => void }) {
  const { login } = useAuth(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const pending = useRef(false);
  const submit = useCallback(async () => { if (pending.current) return; setError(''); pending.current = true; setBusy(true); try { const user = await login(email, password); done(user.onboardingCompleted); } catch (e: any) { setError(e?.message ?? 'Não foi possível entrar. Tente novamente.'); } finally { pending.current = false; setBusy(false); } }, [busy, done, email, login, password]);
  return <View>{error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" selectable style={s.error}>{error}</Text> : null}<Field label="E-mail" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="voce@email.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" /><Field label="Senha" icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="Sua senha" autoCapitalize="none" autoComplete="current-password" textContentType="password" secureTextEntry autoCorrect={false} onSubmitEditing={submit} /><Submit label="Entrar" busy={busy} onPress={submit} /></View>;
}
function Register({ done }: { done: () => void }) {
  const { register } = useAuth(); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const pending = useRef(false);
  const submit = useCallback(async () => { if (pending.current) return; setError(''); if (password !== confirm) { setError('As senhas não coincidem.'); return; } pending.current = true; setBusy(true); try { await register(name, email, password); done(); } catch (e: any) { setError(e?.message ?? 'Não foi possível criar sua conta. Tente novamente.'); } finally { pending.current = false; setBusy(false); } }, [busy, confirm, done, email, name, password, register]);
  return <View>{error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" selectable style={s.error}>{error}</Text> : null}<Field label="Nome" icon="person-outline" value={name} onChangeText={setName} placeholder="Seu nome" autoComplete="name" textContentType="name" /><Field label="E-mail" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="voce@email.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" /><Field label="Senha" icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="Mínimo de 6 caracteres" autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" secureTextEntry /><Field label="Confirmar senha" icon="shield-checkmark-outline" value={confirm} onChangeText={setConfirm} placeholder="Repita a senha" autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" secureTextEntry autoCorrect={false} onSubmitEditing={submit} /><Submit label="Criar conta" busy={busy} onPress={submit} /></View>;
}
type FieldProps = TextInputProps & { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] };
function Field({ label, icon, secureTextEntry, ...props }: FieldProps) {
  const inputRef = useRef<TextInput>(null);
  const onFieldFocus = useContext(FocusedFieldContext);
  const [focus, setFocus] = useState(false);
  const [visible, setVisible] = useState(false);
  return <View style={s.field}><View style={[s.inputWrap, focus && s.inputFocus]}>
    <Ionicons name={icon} size={20} color={focus ? Colors.accent : Colors.textMuted} />
    <TextInput ref={inputRef} {...props} style={s.input} placeholderTextColor={Colors.textMuted} accessibilityLabel={label} secureTextEntry={secureTextEntry && !visible} autoCorrect={secureTextEntry ? false : props.autoCorrect} onFocus={(event) => { setFocus(true); onFieldFocus(inputRef.current); props.onFocus?.(event); }} onBlur={(event) => { setFocus(false); props.onBlur?.(event); }} />
    {secureTextEntry && <TouchableOpacity style={s.eye} onPress={() => setVisible(!visible)} accessibilityRole="button" accessibilityLabel={(visible ? 'Ocultar ' : 'Mostrar ') + label.toLowerCase()} accessibilityState={{ selected: visible }}><Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color={Colors.textSecondary} /></TouchableOpacity>}
  </View></View>;
}
function Submit({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) { return <TouchableOpacity style={[s.cta, busy && s.disabled]} onPress={onPress} disabled={busy} activeOpacity={.85} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: busy, busy }}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={s.ctaText}>{label}</Text><Ionicons name="arrow-forward" size={19} color="#FFFFFF" /></>}</TouchableOpacity>; }

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, opacity: .52 },
  copy: { alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.lg },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 26, lineHeight: 34, letterSpacing: -.6, color: Colors.primary, textAlign: 'center' },
  subtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, lineHeight: 23, color: Colors.textSecondary, textAlign: 'center' },
  eye: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: -Spacing.sm },
  switchMode: { minHeight: 48, marginTop: Spacing.lg, paddingVertical: Spacing.sm, alignItems: 'center', justifyContent: 'center' },
  switchText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, lineHeight: 22, color: Colors.textSecondary, textAlign: 'center' },
  switchLink: { fontFamily: 'PlusJakartaSans_700Bold', color: Colors.accent },
  safe: { flex: 1, backgroundColor: Colors.bg, overflow: 'hidden' }, flex: { flex: 1 },
  hero: { alignSelf: 'center', marginTop: Spacing.sm }, back: { width: 44, height: 44, borderRadius: 18, backgroundColor: 'rgba(246,255,251,0.82)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(216,241,231,0.9)' }, scroll: { flexGrow: 1, width: '100%', maxWidth: 460, alignSelf: 'center', paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.xxl }, error: { marginTop: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, color: Colors.danger, backgroundColor: Colors.dangerLight },
  field: { marginTop: Spacing.md }, inputWrap: { minHeight: INPUT_MIN_HEIGHT, paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard }, inputFocus: { borderColor: Colors.accent }, input: { flex: 1, minWidth: 0, minHeight: 54, paddingVertical: Spacing.md, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, color: Colors.primary },
  cta: { minHeight: 56, paddingVertical: Spacing.md, marginTop: Spacing.xxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: 18, backgroundColor: Colors.accent }, ctaText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#FFFFFF' }, disabled: { opacity: .7 },
});
