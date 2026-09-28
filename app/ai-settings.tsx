import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AccountHeader, AccountScreen, sharedStyles as s } from './account/_shared';
import { Colors, FontSize, Radius, Spacing } from '../src/constants/theme';
import { aiKeyService } from '../src/services/ai-key-service';
import { useAiKeyStatus } from '../src/hooks/use-ai-key-status';
import { useAuth } from '../src/hooks/useAuth';

import { AIProviderError, MissingApiKeyError } from '../src/ai/aiProvider';

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
 * o segredo salvo. O botão "Testar chave" faz uma chamada mínima e barata
 * ao Gemini só pra validar que ela funciona antes de depender dela no
 * onboarding.
 */
export default function AiSettingsScreen() {
  const { currentUser } = useAuth();
  return <AiSettingsForm key={currentUser?.id ?? 'signed-out'} userId={currentUser?.id ?? null} />;
}

function AiSettingsForm({ userId }: { userId: string | null }) {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();

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

  const handleSave = useCallback(async () => {
    const value = draft.trim();
    if (!value) {
      setSaveError('Cole sua chave de API antes de salvar.');
      return;
    }
    setSaveState('saving');
    setSaveError(null);
    try {
      await aiKeyService.save(value, requireUser());
      setDraft('');
      setSaveState('saved');
      setTestState('idle');
      setTestMessage(null);
      await refreshKeyInfo();
      setTimeout(() => setSaveState('idle'), 2500);
    } catch (error) {
      const msg = error instanceof AIProviderError ? error.message : 'Não foi possível salvar a chave.';
      setSaveError(msg);
      setSaveState('idle');
    }
  }, [draft, refreshKeyInfo, userId]);

  const handleRemove = useCallback(() => {
    Alert.alert(
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
              Alert.alert('Erro', msg);
            }
          },
        },
      ],
    );
  }, [userId, refreshKeyInfo]);

  const handleTest = useCallback(async () => {
    setTestState('testing');
    setTestMessage(null);
    try {
      await aiKeyService.test(requireUser(), draft);
      setTestState('ok');
      setTestMessage(draft.trim() ? 'Chave válida. Salve para usar nesta conta.' : 'Chave salva válida. O Gemini respondeu corretamente.');
      if (from === 'onboarding' && !draft.trim()) router.replace('/celebration');
    } catch (error) {
      setTestState('error');
      if (error instanceof MissingApiKeyError) {
        setTestMessage('Nenhuma chave configurada. Salve uma chave antes de testar.');
      } else if (error instanceof AIProviderError) {
        setTestMessage(error.message);
      } else {
        setTestMessage('Falha inesperada ao testar a chave.');
      }
    }
  }, [from, router, userId, draft]);

  const openAiStudio = () => Linking.openURL(AI_STUDIO_URL).catch(() => {});

  return (
    <AccountScreen>
      <AccountHeader title="Inteligência Artificial" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.sectionTitle}>PROVEDOR</Text>
        <View style={styles.providerCard}>
          <Ionicons name="sparkles" size={22} color={Colors.accent} />
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
              <ActivityIndicator color={Colors.accent} />
              <Text style={styles.statusText}>Verificando chave salva...</Text>
            </View>
          ) : keyInfo.status === 'error' ? (
            <View><Text style={s.error}>{keyInfo.error}</Text><TouchableOpacity onPress={refreshKeyInfo}><Text style={styles.helpLinkText}>Tentar novamente</Text></TouchableOpacity></View>
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
          <TextInput
            style={s.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="AIza..."
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            secureTextEntry
            textContentType="none"
            autoComplete="off"
            importantForAutofill="noExcludeDescendants"
            maxLength={256}
            editable={!busy}
          />
          <Text style={styles.hint}>
            Pegue sua chave no Google AI Studio. Depois de salva, o aplicativo
            não consegue consultar seu valor completo.
          </Text>

          {!!saveError && <Text style={s.error}>{saveError}</Text>}

          <TouchableOpacity
            style={[s.primary, saveState === 'saving' && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={busy || !userId}
            activeOpacity={0.85}
          >
            {saveState === 'saving' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={s.primaryText}>{hasKey ? 'Atualizar chave' : 'Salvar chave'}</Text>
            )}
          </TouchableOpacity>

          {saveState === 'saved' && (
            <Text style={styles.savedLabel}>Chave salva no serviço de IA.</Text>
          )}
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
                activeOpacity={0.85}
              >
                {testState === 'testing' ? (
                  <ActivityIndicator color={Colors.accent} />
                ) : (
                  <>
                    <Ionicons name="flash-outline" size={18} color={Colors.accent} />
                    <Text style={styles.testBtnText}>Testar chave</Text>
                  </>
                )}
              </TouchableOpacity>
              {testState === 'ok' && (
                <View style={[styles.testResult, styles.testResultOk]}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                  <Text style={[styles.testResultText, { color: Colors.success }]}>{testMessage}</Text>
                </View>
              )}
              {testState === 'error' && (
                <View style={[styles.testResult, styles.testResultError]}>
                  <Ionicons name="alert-circle" size={18} color={Colors.danger} />
                  <Text style={[styles.testResultText, { color: Colors.danger }]}>{testMessage}</Text>
                </View>
              )}
            </View>

            {hasKey && <><Text style={[s.sectionTitle, { marginTop: Spacing.xxl, color: Colors.danger }]}>REMOVER</Text>
            <TouchableOpacity style={styles.removeBtn} onPress={handleRemove} disabled={busy} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              <Text style={styles.removeBtnText}>Remover chave da conta</Text>
            </TouchableOpacity></>}
          </>
        )}

        <TouchableOpacity style={styles.helpLink} onPress={openAiStudio} activeOpacity={0.7}>
          <Ionicons name="open-outline" size={16} color={Colors.accent} />
          <Text style={styles.helpLinkText}>Abrir Google AI Studio para gerar uma chave</Text>
        </TouchableOpacity>
      </ScrollView>
    </AccountScreen>
  );
}

const styles = StyleSheet.create({
  providerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
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
  statusDotOk: { backgroundColor: Colors.success },
  statusDotEmpty: { backgroundColor: Colors.textMuted },
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
  savedLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.success,
    textAlign: 'center',
    marginTop: Spacing.sm,
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
    borderColor: Colors.accent,
    borderRadius: 14,
  },
  testBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md,
    color: Colors.accent,
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
    borderColor: Colors.danger,
    borderRadius: 14,
  },
  removeBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md,
    color: Colors.danger,
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
    color: Colors.accent,
  },
});
