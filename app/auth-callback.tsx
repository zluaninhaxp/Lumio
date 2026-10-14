import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AccountHeader, AccountScreen } from '../src/components/account/_shared';
import { accountLayout } from '../src/components/account-menu';
import { Colors, Spacing } from '../src/constants/theme';
import { exchangeAuthLink, AUTH_REDIRECT } from '../src/services/authLinks';
import { authService } from '../src/services/authService';
import { useAuth } from '../src/hooks/useAuth';

export default function AuthCallback() {
  const router = useRouter(); const params = useLocalSearchParams<{ code?: string; intent?: string; error?: string }>();
  const { retryInitialization } = useAuth(); const started = useRef(false); const busy = useRef(false);
  const [recovery,setRecovery] = useState(false); const [ready,setReady] = useState(false); const [message,setMessage] = useState('Verificando link…');
  const [password,setPassword] = useState(''); const [confirmation,setConfirmation] = useState('');
  useEffect(() => { if (started.current) return; started.current = true; let active = true;
    void (async () => {
      const raw = params.code || params.error ? AUTH_REDIRECT + '?' + new URLSearchParams({ ...(params.code ? { code: params.code } : {}), ...(params.intent ? { intent: params.intent } : {}), ...(params.error ? { error: params.error } : {}) }) : await Linking.getInitialURL();
      if (!raw) throw new Error('Link indisponível. Solicite um novo e-mail.');
      const isRecovery = await exchangeAuthLink(raw);
      await retryInitialization();
      if (active) { setRecovery(isRecovery); setReady(true); setMessage(isRecovery ? 'Defina uma nova senha.' : 'E-mail confirmado. Você pode continuar na sua conta.'); }
    })().catch(error => { if(active) setMessage(error instanceof Error ? error.message : 'Não foi possível verificar o link.'); });
    return () => { active = false; };
  }, [params.code, params.error, params.intent, retryInitialization]);
  const save = async () => { if (busy.current) return; if (password !== confirmation) return setMessage('As senhas não coincidem.'); busy.current = true;
    try { await authService.completePasswordRecovery(password); setRecovery(false); setMessage('Senha atualizada. Você pode continuar.'); }
    catch(error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar.'); } finally { busy.current = false; }
  };
  return <AccountScreen><AccountHeader refined title="Acesso à conta" onBack={() => router.replace('/login')} /><ScrollView contentContainerStyle={accountLayout.content}>
    <Text accessibilityRole="alert" style={{ color: Colors.ink }}>{message}</Text>
    {ready && recovery ? <>
      <TextInput accessibilityLabel="Nova senha" secureTextEntry value={password} onChangeText={setPassword} placeholder="Nova senha" style={{ padding: Spacing.lg, color: Colors.ink }} />
      <TextInput accessibilityLabel="Confirmar nova senha" secureTextEntry value={confirmation} onChangeText={setConfirmation} placeholder="Confirmar senha" style={{ padding: Spacing.lg, color: Colors.ink }} />
      <TouchableOpacity accessibilityRole="button" onPress={() => void save()} style={{ padding: Spacing.lg }}><Text style={{ color: Colors.accentText }}>Salvar nova senha</Text></TouchableOpacity>
    </> : <TouchableOpacity accessibilityRole="button" onPress={() => router.replace(ready ? '/' : '/recover-access')} style={{ padding: Spacing.lg }}><Text style={{ color: Colors.accentText }}>{ready ? 'Continuar' : 'Solicitar novo link'}</Text></TouchableOpacity>}
  </ScrollView></AccountScreen>;
}
