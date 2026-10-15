import { useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AccountHeader, AccountScreen } from '../src/components/account/_shared';
import { accountLayout } from '../src/components/account-menu';
import { Colors, Typography, Spacing } from '../src/constants/theme';
import { authService } from '../src/services/authService';

export default function RecoverAccess() {
  const router = useRouter(); const params = useLocalSearchParams<{ confirmation?: string; email?: string }>();
  const confirmation = params.confirmation === '1';
  const [email,setEmail] = useState(params.email ?? ''); const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false); const pending = useRef(false);
  const submit = async () => { if (pending.current) return; pending.current = true; setBusy(true); setMessage(''); try {
    if (confirmation) await authService.resendConfirmation(email); else await authService.requestPasswordRecovery(email);
    setMessage('Se houver uma conta elegível, você receberá um e-mail. Confira também o spam. Abra o link neste aparelho; depois volte ao aplicativo.');
  } catch(error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar. Tente novamente.'); } finally { pending.current = false; setBusy(false); } };
  return <AccountScreen><AccountHeader refined title={confirmation ? 'Confirme seu e-mail' : 'Recuperar acesso'} onBack={() => router.canGoBack() ? router.back() : router.replace('/login')} />
    <ScrollView contentContainerStyle={accountLayout.content}>
      <Text style={{ color: Colors.ink, fontFamily: Typography.regular, lineHeight: 24 }}>{confirmation ? 'Sua conta foi criada. Confirme o e-mail para entrar. Se precisar, solicite outro link abaixo.' : 'Solicite um link para definir uma nova senha. Por segurança, o envio não confirma se o e-mail está cadastrado.'}</Text>
      <TextInput accessibilityLabel="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!busy} placeholder="E-mail" style={{ color: Colors.ink, padding: Spacing.lg, backgroundColor: Colors.bgCard, marginVertical: Spacing.lg }} />
      {message ? <Text accessibilityRole="alert" style={{ color: Colors.ink }}>{message}</Text> : null}
      <TouchableOpacity disabled={busy} accessibilityRole="button" onPress={() => void submit()} style={{ padding: Spacing.lg }}>{busy ? <ActivityIndicator color={Colors.accentIcon} /> : <Text style={{ color: Colors.accentText }}>{confirmation ? 'Reenviar confirmação' : 'Enviar link de recuperação'}</Text>}</TouchableOpacity>
      <TouchableOpacity accessibilityRole="link" onPress={() => router.replace('/login')} style={{ padding: Spacing.lg }}><Text style={{ color: Colors.accentText }}>Voltar para entrar</Text></TouchableOpacity>
    </ScrollView>
  </AccountScreen>;
}
