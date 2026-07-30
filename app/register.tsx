import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../src/constants/theme';
import { useAuth } from '../src/hooks/useAuth';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = useCallback(async () => {
    if (submitting) return;
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }

    setSubmitting(true);
    try {
      await register(name, email, password);
      router.replace('/onboarding');
    } catch (error: any) {
      setErrorMessage(error?.message ?? 'Não foi possível criar sua conta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }, [name, email, password, confirmPassword, register, router, submitting]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.logo}>Lumio</Text>
          <Text style={styles.title}>Criar conta</Text>
          <Text style={styles.subtitle}>Leva menos de um minuto.</Text>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <Text style={styles.label}>Nome</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Seu nome"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="words"
            textContentType="name"
          />

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="voce@email.com"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo de 6 caracteres"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            textContentType="newPassword"
          />

          <Text style={styles.label}>Confirmar senha</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repita a senha"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            textContentType="newPassword"
            onSubmitEditing={handleRegister}
            returnKeyType="go"
          />

          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
            onPress={handleRegister}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Criar conta</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              Já tem conta? <Text style={styles.linkTextBold}>Entrar</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  logo: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: FontSize.xxl,
    color: Colors.accent,
    marginBottom: Spacing.xxl,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.xxxl,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxl,
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorBox: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.danger,
  },
  primaryBtn: {
    marginTop: Spacing.xxl,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md,
    color: '#FFFFFF',
  },
  linkBtn: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  linkText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  linkTextBold: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: Colors.accent,
  },
});
