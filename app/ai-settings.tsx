import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { AccountHeader, AccountScreen, sharedStyles as s } from './account/_shared';
import { ControlOpacity, Colors, FontSize, Radius, Spacing, SurfaceStyles } from '../src/constants/theme';
import { aiKeyService } from '../src/services/ai-key-service';
import { useAiKeyStatus } from '../src/hooks/use-ai-key-status';
import { useAuth } from '../src/hooks/useAuth';
import ApiKeyInput from '../src/components/api-key-input';

import { AIProviderError, MissingApiKeyError } from '../src/ai/aiProvider';
import { AppAlert } from "@/src/services/appAlert";

const AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';

type SaveState = 'idle' | 'saving' | 'saved';
type TestState = 'idle' | 'testing' | 'ok' | 'error';

/**
 * Tela de configurações de IA (BYOK — Bring Your Own Key).
 *
 * Cada usuário cadastra sua chave no serviço de IA autenticado. O aplicativo
 * recebe apenas o estado configurado/ausente, sem consultar o valor salvo.
 *
 * Depois de salva, só o status é exibido. O campo de edição nunca recebe
 * o segredo salvo. "Testar conexão" valida sem salvar ou navegar;
 * a confirmação seguinte salva e segue conforme a origem da tela.
 */
export default function AiSettingsScreen() {
  const { currentUser } = useAuth();
  return <AiSettingsForm key={currentUser?.id ?? 'signed-out'} userId={currentUser?.id ?? null} />;
}

function AiSettingsForm({ userId }: { userId: string | null }) {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const onboarding = from === 'onboarding';
  const operationRef = useRef(false);
  const activeRef = useRef(true);

  const keyInfo = useAiKeyStatus(userId);
  const hasKey = keyInfo.status === 'configured';
  const loadingInfo = keyInfo.status === 'loading';
  const masked = hasKey ? 'Configurada no servidor' : null;
  const refreshKeyInfo = keyInfo.refresh;
  const requireUser = () => { if (!userId) throw new AIProviderError('not-authenticated'); return userId; };

  const [draft, setDraft] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const [testState, setTestState] = useState<TestState>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const busy = saveState === 'saving' || testState === 'testing';
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);
  useFocusEffect(useCallback(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      setDraft('');
      setTestState('idle');
      setTestMessage(null);
    };
  }, []));

  const handleSave = useCallback(async () => {
    if (operationRef.current || !activeRef.current || testState !== 'ok') return;
    const value = draft.trim();
    if (!value && !hasKey) {
      setSaveError('Cole sua chave de API antes de salvar.');
      return;
    }
    operationRef.current = true;
    setSaveState('saving');
    setSaveError(null);
    try {
      if (value) await aiKeyService.save(value, requireUser());
      if (!activeRef.current) return;
      setDraft('');
      setSaveState('saved');
      setTestState('idle');
      setTestMessage(null);
      activeRef.current = false;
      if (onboarding) router.replace('/celebration');
      else if (from === 'resources' || from === 'settings') router.dismissTo({ pathname: '/resources', params: { aiKeySaved: '1' } });
      else router.back();
    } catch (error) {
      if (!activeRef.current) return;
      const msg = error instanceof AIProviderError ? error.message : 'Não foi possível salvar a chave.';
      setSaveError(msg);
      setSaveState('idle');
    } finally {
      operationRef.current = false;
    }
  }, [draft, hasKey, testState, onboarding, from, router, userId]);

  const handleRemove = useCallback(() => {
    AppAlert.alert(
      'Remover chave de IA?',
      'Você precisará configurar uma nova chave para gerar relatórios de negócio com IA no onboarding.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await aiKeyService.remove(requireUser());
              await refreshKeyInfo();
              setDraft('');
              setTestState('idle');
              setTestMessage(null);
              setSaveState('idle');
              setSaveError(null);
            } catch (error) {
              const msg = error instanceof AIProviderError ? error.message : 'Não foi possível remover a chave.';
              AppAlert.alert('Erro', msg, undefined, { variant: 'warning' });
            }
          },
        },
      ],
    );
  }, [userId, refreshKeyInfo]);

  const handleTest = useCallback(async () => {
    if (operationRef.current || !activeRef.current) return;
    operationRef.current = true;
    setTestState('testing');
    setTestMessage(null);
    try {
      await aiKeyService.test(requireUser(), draft);
      if (!activeRef.current) return;
      setTestState('ok');
      setTestMessage('Conexão realizada com sucesso!');
    } catch (error) {
      if (!activeRef.current) return;
      setTestState('error');
      if (error instanceof MissingApiKeyError) {
        setTestMessage('Nenhuma chave configurada. Informe uma chave antes de testar.');
      } else if (error instanceof AIProviderError && !['unauthorized', 'invalid-input'].includes(error.kind)) {
        setTestMessage(error.message);
      } else {
        setTestMessage('Não foi possível validar essa chave. Confira a chave informada e tente novamente.');
      }
    } finally {
      operationRef.current = false;
    }
  }, [userId, draft]);

  const openAiStudio = () => Linking.openURL(AI_STUDIO_URL).catch(() => {});

  return (
    <AccountScreen>
      <AccountHeader title="Inteligência Artificial" onBack={() => { activeRef.current = false; setDraft(''); router.back(); }} />
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.sectionTitle}>PROVEDOR</Text>
        <View style={styles.providerCard}>
          <Ionicons name="sparkles" size={22} color={Colors.accentIcon} />
          <View style={styles.providerText}>
            <Text style={styles.providerName}>Google Gemini</Text>
            <Text style={styles.providerDesc}>
              O Lumio usa sua chave do Google AI Studio por meio de um serviço
              autenticado. A chave fica protegida no servidor e pode ser usada
              depois do login em outro dispositivo.
            </Text>
          </View>
        </View>

        <Text style={[s.sectionTitle, { marginTop: Spacing.xxl }]}>SUA CHAVE DE API</Text>
        <View style={s.card}>
          {loadingInfo ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color={Colors.accentIcon} />
              <Text style={styles.statusText}>Verificando chave salva...</Text>
            </View>
          ) : keyInfo.status === 'error' ? (
            <View><Text style={s.error}>{keyInfo.error}</Text><TouchableOpacity activeOpacity={ControlOpacity.pressed} onPress={refreshKeyInfo}><Text style={styles.helpLinkText}>Tentar novamente</Text></TouchableOpacity></View>
          ) : hasKey ? (
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, styles.statusDotOk]} />
              <Text style={styles.statusText}>Chave configurada</Text>
              <Text style={styles.statusMasked}>{masked}</Text>
            </View>
          ) : (
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, styles.statusDotEmpty]} />
              <Text style={styles.statusText}>Nenhuma chave configurada</Text>
            </View>
          )}

          <Text style={[s.label, { marginTop: Spacing.lg }]}>
            {hasKey ? 'Trocar chave (cole uma nova por cima)' : 'Cole sua chave de API'}
          </Text>
          <ApiKeyInput
            style={s.input}
            value={draft}
            onChangeText={(value) => { setDraft(value); setTestState('idle'); setTestMessage(null); setSaveError(null); setSaveState('idle'); }}
            placeholder="AIza..."
            placeholderTextColor={Colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            keyboardType="default"
            textContentType={Platform.OS === 'ios' ? 'none' : undefined}
            autoComplete={Platform.OS === 'ios' ? undefined : 'off'}
            // API keys must not join Android's autofill/credential structure.
            importantForAutofill="noExcludeDescendants"
            maxLength={256}
            editable={!busy}
          />
          <Text style={styles.hint}>
            Pegue sua chave no Google AI Studio. Depois de salva, o aplicativo
            não consegue consultar seu valor completo.
          </Text>

        </View>

        {(hasKey || !!draft.trim()) && (
          <>
            <Text style={[s.sectionTitle, { marginTop: Spacing.xxl }]}>VALIDAÇÃO</Text>
            <View style={s.card}>
              <Text style={styles.sectionDesc}>
                Verifica se sua chave funciona com uma chamada mínima e
                barata ao Gemini antes de depender dela no onboarding.
              </Text>
              <TouchableOpacity
                style={styles.testBtn}
                onPress={handleTest}
                disabled={busy || !userId}
                activeOpacity={ControlOpacity.pressed}
              >
                {testState === 'testing' ? (
                  <ActivityIndicator color={Colors.accentIcon} />
                ) : (
                  <>
                    <Ionicons name="flash-outline" size={18} color={Colors.accentIcon} />
                    <Text style={styles.testBtnText}>Testar conexão</Text>
                  </>
                )}
              </TouchableOpacity>
              {testState === 'ok' && (
                <View style={[styles.testResult, styles.testResultOk]}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.successIcon} />
                  <Text style={[styles.testResultText, { color: Colors.successText }]}>{testMessage}</Text>
                </View>
              )}
              {testState === 'error' && (
                <View style={[styles.testResult, styles.testResultError]}>
                  <Ionicons name="alert-circle" size={18} color={Colors.dangerIcon} />
                  <Text style={[styles.testResultText, { color: Colors.dangerText }]}>{testMessage}</Text>
                </View>
              )}
              {!!saveError && <Text style={s.error}>{saveError}</Text>}
              {testState === 'ok' && <TouchableOpacity
                style={[s.primary, { marginTop: Spacing.md }, busy && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={busy || !userId}
                activeOpacity={ControlOpacity.pressed}
              >
                {saveState === 'saving' ? <ActivityIndicator color={Colors.onAction} /> :
                  <Text style={s.primaryText}>{onboarding ? 'Salvar e continuar' : 'Salvar chave'}</Text>}
              </TouchableOpacity>}
            </View>

            {hasKey && <><Text style={[s.sectionTitle, { marginTop: Spacing.xxl, color: Colors.dangerText }]}>REMOVER</Text>
            <TouchableOpacity style={styles.removeBtn} onPress={handleRemove} disabled={busy} activeOpacity={ControlOpacity.pressed}>
              <Ionicons name="trash-outline" size={18} color={Colors.dangerIcon} />
              <Text style={styles.removeBtnText}>Remover chave da conta</Text>
            </TouchableOpacity></>}
          </>
        )}

        <TouchableOpacity style={styles.helpLink} onPress={openAiStudio} activeOpacity={ControlOpacity.pressed}>
          <Ionicons name="open-outline" size={16} color={Colors.accentIcon} />
          <Text style={styles.helpLinkText}>Abrir Google AI Studio para gerar uma chave</Text>
        </TouchableOpacity>
      </ScrollView>
    </AccountScreen>
  );
}

const styles = StyleSheet.create({
  providerCard: {
      ...SurfaceStyles.card,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  providerText: { flex: 1 },
  providerName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md,
    color: Colors.primary,
    marginBottom: 4,
  },
  providerDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOk: { backgroundColor: Colors.successIcon },
  statusDotEmpty: { backgroundColor: Colors.iconMuted },
  statusText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  statusMasked: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
  hint: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  sectionDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 19,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: Colors.accentIcon,
    borderRadius: 14,
  },
  testBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md,
    color: Colors.accentText,
  },
  testResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  testResultOk: { backgroundColor: Colors.accentLight },
  testResultError: { backgroundColor: Colors.dangerLight },
  testResultText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: Colors.dangerIcon,
    borderRadius: 14,
  },
  removeBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md,
    color: Colors.dangerText,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xxl,
    minHeight: 44,
  },
  helpLinkText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.accentText,
  },
});
