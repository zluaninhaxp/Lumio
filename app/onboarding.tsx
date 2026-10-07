import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal, Pressable, View, Text, StyleSheet, TouchableOpacity,
  BackHandler, Keyboard, KeyboardAvoidingView, Platform, Image, ScrollView, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '../src/components/back-button';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, useReducedMotion, Easing } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useAppStore } from '../src/store';
import { useAuth } from '../src/hooks/useAuth';
import { useAiKeyStatus } from '../src/hooks/use-ai-key-status';
import { AIProviderError } from '../src/ai/aiProvider';
import {
  OPEN_QUESTIONS,
  OpenOnboardingAnswers,
} from '../src/engine/openOnboardingEngine';
import { ONBOARDING_INTRO } from '../src/data/onboardingQuestions';
import {
  BLOCK_MASCOT_EXPRESSION,
  INTERACTION_MASCOT,
  MascotExpressionKey,
} from '../src/data/mascotExpressions';
import Svg, { Path } from 'react-native-svg';
import LumioSpeechBubble from './components/onboarding/lumio-speech-bubble';
import { onboardingAiMessages, onboardingMessages } from '../src/data/onboarding-messages';
import { onboardingService } from '../src/services/onboardingService';
import { onboardingRepository } from '../src/repositories/onboardingRepository';
import UserReply from './components/onboarding/UserReply';
import VoiceInput from './components/onboarding/VoiceInput';
import { MessageComposer } from '../src/components/message-composer';
import { Colors, SurfaceStyles } from '../src/constants/theme';

const BLOCK_COUNT = OPEN_QUESTIONS.length;
const TOTAL_STAGES = BLOCK_COUNT + 1;

interface Line {
  key: string;
  text: string;
  expression: MascotExpressionKey;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const applyOpenOnboardingConfig = useAppStore((s) => s.applyOpenOnboardingConfig);
  const { isAuthenticated, currentUser, loading, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [messageHeight, setMessageHeight] = useState(0);
  const [composerHeight, setComposerHeight] = useState(0);
  const [composerTop, setComposerTop] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const conversationLift = useSharedValue(0);
  const keyboardFade = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const keyboardDuration = useRef(220);
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());

  useEffect(() => {
    // KeyboardAvoidingView owns input movement; never add keyboard height as padding.
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        keyboardDuration.current = event.duration > 0 ? event.duration : 220;
        setKeyboardVisible(true);
      },
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (event) => {
        keyboardDuration.current = event.duration > 0 ? event.duration : 220;
        setKeyboardVisible(false);
        setInputFocused(false);
      },
    );
    return () => { show.remove(); hide.remove(); };
  }, []);
  const composerBottomInset = keyboardVisible ? 0 : insets.bottom;

  useEffect(() => {
    if (!isFocused) return;
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    } else if (!loading && currentUser?.onboardingCompleted) {
      router.replace('/(tabs)/chat');
    }
  }, [loading, isAuthenticated, currentUser, isFocused, router]);

  const blockIndexRef = useRef(0);
  const answersRef = useRef<OpenOnboardingAnswers>({ ...useAppStore.getState().openAnswers });
  const followUpUsedRef = useRef<Record<string, boolean>>({});
  const attemptCountRef = useRef<Record<string, number>>({});
  const queueTokenRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  const [blockIndex, setBlockIndex] = useState(0);
  const [showIntro, setShowIntro] = useState(() => !useAppStore.getState().onboardingContext);
  const [introFinished, setIntroFinished] = useState(false);
  const [restartConfirmationVisible, setRestartConfirmationVisible] = useState(false);
  const [showAiTransition, setShowAiTransition] = useState(() => !!useAppStore.getState().onboardingContext);
  const conversationBottomPadding = Math.max(showAiTransition ? 150 : 100, composerHeight + 8);
  const preferredHeroHeight = Math.min(Math.max(height * 0.46, 260), 480);
  const fittedHeroHeight = !messageHeight
    ? preferredHeroHeight
    : Math.min(preferredHeroHeight, Math.max(0, height - insets.top - Math.max(210, messageHeight + 12 + conversationBottomPadding)));
  const restingHeroHeight = useRef(fittedHeroHeight);
  if (!inputFocused && !keyboardVisible) restingHeroHeight.current = fittedHeroHeight;
  const heroHeight = restingHeroHeight.current;
  useEffect(() => {
    const restingTop = heroHeight + insets.top + 12;
    const lift = keyboardVisible && composerTop > 0
      ? Math.min(0, composerTop - messageHeight - 12 - restingTop)
      : 0;
    const config = { duration: reducedMotion ? 0 : keyboardDuration.current, easing: Easing.out(Easing.cubic) };
    conversationLift.value = withTiming(lift, config);
    keyboardFade.value = withTiming(keyboardVisible ? 1 : 0, config);
  }, [keyboardVisible, composerTop, messageHeight, heroHeight, insets.top, reducedMotion, conversationLift, keyboardFade]);
  const conversationMotion = useAnimatedStyle(() => ({ transform: [{ translateY: conversationLift.value }] }));
  const conversationFade = useAnimatedStyle(() => ({ opacity: keyboardFade.value }));
  const keyInfo = useAiKeyStatus(currentUser?.id ?? null, showAiTransition);
  const [skipAiConfirmationVisible, setSkipAiConfirmationVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const proceedingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  const [isTyping, setIsTyping] = useState(false);
  const [currentLine, setCurrentLine] = useState<Line | null>(null);
  const [lastUserReply, setLastUserReply] = useState<{ text: string; isVoice?: boolean } | null>(null);

  // Encadeia as falas do mascote uma de cada vez, com uma pequena pausa de
  // "pensando" entre elas — dá a sensação de conversa guiada em vez de
  // despejar todo o texto de uma vez.
  const queueLines = useCallback((lines: Line[], onComplete?: () => void) => {
    const token = ++queueTokenRef.current;
    setLastUserReply(null);
    let i = 0;
    const step = () => {
      if (queueTokenRef.current !== token) return;
      if (i >= lines.length) {
        setIsTyping(false);
        onComplete?.();
        return;
      }
      setIsTyping(true);
      setTimeout(() => {
        if (queueTokenRef.current !== token) return;
        setIsTyping(false);
        setCurrentLine(lines[i]);
        i += 1;
        setTimeout(step, 1500);
      }, 550);
    };
    step();
  }, []);

  const enterBlock = useCallback((index: number) => {
    const block = OPEN_QUESTIONS[index];
    queueLines([{
      key: `${block.id}-question`,
      text: block.question,
      expression: BLOCK_MASCOT_EXPRESSION[block.id] ?? 'neutro',
    }]);
  }, [queueLines]);

  useEffect(() => {
    setCurrentLine({
      key: 'intro',
      text: ONBOARDING_INTRO.lines.join('\n\n'),
      expression: 'feliz',
    });
    setIntroFinished(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = useCallback(() => {
    setShowIntro(false);
    enterBlock(0);
  }, [enterBlock]);

  const handleRestartOnboarding = useCallback(() => {
    if (showAiTransition) {
      setShowAiTransition(false);
      setShowIntro(false);
      setBlockIndex(BLOCK_COUNT - 1);
      blockIndexRef.current = BLOCK_COUNT - 1;
      setInputValue(answersRef.current[OPEN_QUESTIONS[BLOCK_COUNT - 1].id] ?? '');
      enterBlock(BLOCK_COUNT - 1);
      return;
    }
    setRestartConfirmationVisible(true);
  }, [showAiTransition, enterBlock]);

  useFocusEffect(useCallback(() => {
    if (!showAiTransition) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleRestartOnboarding();
      return true;
    });
    return () => subscription.remove();
  }, [showAiTransition, handleRestartOnboarding]));

  const confirmRestartOnboarding = useCallback(() => {
    setRestartConfirmationVisible(false);
    Keyboard.dismiss();
    queueTokenRef.current += 1;
    answersRef.current = {};
    useAppStore.getState().resetOnboardingState();
    followUpUsedRef.current = {};
    attemptCountRef.current = {};
    blockIndexRef.current = 0;
    setBlockIndex(0);
    setShowIntro(true);
    setShowAiTransition(false);
    setInputValue('');
    setLastUserReply(null);
    setIsTyping(false);
    setCurrentLine({
      key: 'intro',
      text: ONBOARDING_INTRO.lines.join('\n\n'),
      expression: 'feliz',
    });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const handleConfigureKey = useCallback(() => {
    router.push({ pathname: '/ai-settings', params: { from: 'onboarding' } });
  }, [router]);

  const advanceFromBlock = useCallback((currentIndex: number) => {
    const next = currentIndex + 1;
    if (next >= BLOCK_COUNT) {
      applyOpenOnboardingConfig(answersRef.current);
      queueTokenRef.current += 1;
      setIsTyping(false);
      setLastUserReply(null);
      setShowIntro(false);
      setShowAiTransition(true);
    } else {
      setBlockIndex(next);
      blockIndexRef.current = next;
      enterBlock(next);
    }
  }, [enterBlock, applyOpenOnboardingConfig]);

  const submitAnswer = useCallback((text: string, isVoice: boolean) => {
    const currentIndex = blockIndexRef.current;
    const block = OPEN_QUESTIONS[currentIndex];
    const attempt = (attemptCountRef.current[block.id] ?? 0) + 1;
    attemptCountRef.current[block.id] = attempt;

    setLastUserReply({ text, isVoice });
    setInputValue('');

    const newAnswers = { ...answersRef.current, [block.id]: text };
    answersRef.current = newAnswers;

    const isShort = text.length < block.minLengthForFollowUp;
    const alreadyFollowedUp = followUpUsedRef.current[block.id];

    if (isShort && !alreadyFollowedUp) {
      followUpUsedRef.current[block.id] = true;
      queueLines([{
        key: `${block.id}-followup-${attempt}`,
        text: block.followUp,
        expression: INTERACTION_MASCOT.followUp,
      }]);
      return;
    }

    advanceFromBlock(currentIndex);
  }, [advanceFromBlock, queueLines]);

  const handleSubmit = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;
    Keyboard.dismiss();
    submitAnswer(text, false);
  }, [inputValue, submitAnswer]);

  const handleVoiceCapture = useCallback((transcript: string) => {
    if (!transcript.trim()) return;
    setInputValue(transcript.trim());
  }, []);

  const handleSkip = useCallback(() => {
    const currentIndex = blockIndexRef.current;
    const block = OPEN_QUESTIONS[currentIndex];
    if (!block?.optional) return;

    setLastUserReply({ text: '(pulou esta pergunta)' });
    setInputValue('');
    advanceFromBlock(currentIndex);
  }, [advanceFromBlock]);

  const saveCollectedAnswers = useCallback(async () => {
    if (!currentUser) throw new Error('Entre na sua conta para salvar suas respostas.');
    await onboardingRepository.save(currentUser.id, {
      responses: { ...answersRef.current }, context: useAppStore.getState().onboardingContext,
    });
  }, [currentUser]);

  useEffect(() => {
    if (!showAiTransition) return;
    setSaving(true);
    setSaveError(null);
    saveCollectedAnswers().catch(() => setSaveError('Não consegui salvar suas respostas. Tente novamente antes de continuar.'))
      .finally(() => setSaving(false));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [showAiTransition, saveCollectedAnswers]);

  const proceedToAiSettings = async () => {
    if (saving || proceedingRef.current || !['configured', 'notConfigured'].includes(keyInfo.status)) return;
    proceedingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await saveCollectedAnswers();
      if (!currentUser) throw new AIProviderError('not-authenticated');
      if (keyInfo.status === 'configured') router.replace('/celebration');
      else handleConfigureKey();
    }
    catch (error) { proceedingRef.current = false; setSaveError(error instanceof AIProviderError ? error.message : 'Não consegui salvar suas respostas. Tente novamente.'); }
    finally { setSaving(false); }
  };

  useFocusEffect(useCallback(() => { proceedingRef.current = false; }, []));

  const finishWithoutAi = async () => {
    if (saving || !currentUser) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onboardingService.completeOnboarding(currentUser.id, { ...answersRef.current }, useAppStore.getState().onboardingContext ?? undefined);
      useAppStore.setState({ onboardingCompleted: true });
      setSkipAiConfirmationVisible(false);
      await refreshUser();
      router.replace('/(tabs)/chat');
    } catch { setSaveError('Não consegui concluir. Suas respostas foram preservadas; tente novamente.'); }
    finally { setSaving(false); }
  };

  const closeConfirmation = () => {
    if (saving) return;
    setRestartConfirmationVisible(false);
    setSkipAiConfirmationVisible(false);
  };

  const currentBlock = blockIndex < BLOCK_COUNT ? OPEN_QUESTIONS[blockIndex] : null;
  const stage = showAiTransition ? TOTAL_STAGES : showIntro ? 1 : blockIndex + 2;
  const fallbackVisible = !showIntro && !!currentBlock &&
    currentLine?.key.startsWith(`${currentBlock.id}-followup-`) === true;

  useEffect(() => {
    if (!showIntro) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [showIntro, blockIndex]);

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        enabled={Platform.OS === 'ios' || (Platform.OS === 'android' && keyboardVisible)}
        behavior="padding"
      >
        <View style={styles.flex}>
          <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} onContentSizeChange={() => { if (showIntro) scrollRef.current?.scrollToEnd({ animated: true }); }}>
            <View style={[styles.hero, { height: heroHeight + insets.top }]}>
              <Image source={require('../assets/onboarding-hero.png')} style={styles.heroImage} resizeMode="cover" />
              <LinearGradient pointerEvents="none" colors={['rgba(249,255,252,0.94)', 'rgba(249,255,252,0.68)', 'rgba(249,255,252,0)']} locations={[0, 0.45, 1]} style={styles.headerVeil} />
              <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                {(!showIntro || showAiTransition) && <BackButton onPress={handleRestartOnboarding} accessibilityLabel={showAiTransition ? 'Voltar à última pergunta' : 'Voltar ao início do onboarding'} />}
                <View style={styles.headerCenter}>
                  <Text style={styles.headerTitle}>Configurando seu Lumio</Text>
                  <View style={styles.progressRow}>{Array.from({ length: TOTAL_STAGES }).map((_, index) => <View key={index} style={[styles.progressSegment, index < stage && styles.progressActive]} />)}</View>
                </View>
              </View>
              <View style={styles.heroCurve} pointerEvents="none"><Svg width={width} height={74} viewBox="0 0 400 74" preserveAspectRatio="none"><Path d="M0 35 C75 60 130 66 206 65 C293 64 349 43 400 5 L400 74 L0 74Z" fill="#F3FFF9" /></Svg></View>
            </View>
            <View style={[styles.conversation, { paddingBottom: conversationBottomPadding }]}>
              <View pointerEvents="none" style={styles.waves}><Svg width={width} height={150} viewBox="0 0 400 150" preserveAspectRatio="none"><Path d="M0 47 C75 35 135 118 225 102 C305 88 330 30 400 15 L400 150 L0 150Z" fill="#D6F5E8" /><Path d="M0 76 C95 75 140 153 245 120 C316 101 340 117 400 91 L400 150 L0 150Z" fill="#78D5BA" /><Path d="M0 115 C80 88 135 144 220 137 C310 126 338 132 400 113 L400 150 L0 150Z" fill="#39B99A" /></Svg></View>
              <View style={[styles.messageStack, styles.messageStackTop]}>
                <Animated.View style={[styles.messageContent, conversationMotion]} onLayout={(event) => setMessageHeight(event.nativeEvent.layout.height)}>
                  <Animated.View pointerEvents="none" style={[styles.keyboardContrast, conversationFade]}>
                    <LinearGradient colors={['rgba(243,255,249,0)', 'rgba(243,255,249,0.4)', 'rgba(243,255,249,0.82)', 'rgba(243,255,249,0)']} locations={[0, 0.28, 0.75, 1]} style={StyleSheet.absoluteFillObject} />
                  </Animated.View>
                <LumioSpeechBubble
                  key={showAiTransition ? "ai-A" : `stage-${stage}-A`}
                  message={showAiTransition ? onboardingAiMessages.A : onboardingMessages[stage].A}
                />
                {(showAiTransition || showIntro || fallbackVisible) && (
                  <LumioSpeechBubble
                    key={showAiTransition ? "ai-B" : `stage-${stage}-B`}
                    message={showAiTransition ? onboardingAiMessages.B : onboardingMessages[stage].B}
                    delayMs={showIntro || showAiTransition ? 1400 : 0}
                  />
                )}
                {lastUserReply && <UserReply text={lastUserReply.text} isVoice={lastUserReply.isVoice} />}
                </Animated.View>
              </View>
            </View>
          </ScrollView>
          {showAiTransition ? <View onLayout={(event) => { setComposerHeight(event.nativeEvent.layout.height); setComposerTop(event.nativeEvent.layout.y); }} style={[styles.composerArea, { paddingBottom: Math.max(composerBottomInset, 12) }]}>
            {!!saveError && <Text style={styles.confirmationMessage}>{saveError}</Text>}
            {keyInfo.status === 'error' && <TouchableOpacity onPress={keyInfo.refresh}><Text style={styles.confirmationMessage}>{keyInfo.error} Toque para tentar novamente.</Text></TouchableOpacity>}
            <TouchableOpacity style={[styles.startBtn, (saving || keyInfo.status === 'loading' || keyInfo.status === 'error') && styles.sendBtnDisabled]} disabled={saving || keyInfo.status === 'loading' || keyInfo.status === 'error'} onPress={proceedToAiSettings} activeOpacity={0.85}><Text style={styles.startBtnText}>{saving ? 'Salvando...' : keyInfo.status === 'loading' ? 'Verificando IA...' : keyInfo.status === 'configured' ? 'Personalizar meu Lumio' : 'Configurar IA'}</Text><Ionicons name="arrow-forward" size={20} color="#FFFFFF" /></TouchableOpacity>
            <TouchableOpacity style={styles.confirmationSecondary} disabled={saving} onPress={() => setSkipAiConfirmationVisible(true)}><Text style={styles.confirmationSecondaryText}>Continuar sem IA</Text></TouchableOpacity>
          </View> : showIntro ? <View onLayout={(event) => { setComposerHeight(event.nativeEvent.layout.height); setComposerTop(event.nativeEvent.layout.y); }} style={[styles.composerArea, { paddingBottom: Math.max(composerBottomInset, 12) }]}><TouchableOpacity style={[styles.startBtn, !introFinished && styles.sendBtnDisabled]} onPress={handleStart} disabled={!introFinished} activeOpacity={0.85}><Text style={styles.startBtnText}>Vamos lá</Text><Ionicons name="arrow-forward" size={20} color="#FFFFFF" /></TouchableOpacity></View>
          : currentBlock?.options ? <View onLayout={(event) => { setComposerHeight(event.nativeEvent.layout.height); setComposerTop(event.nativeEvent.layout.y); }} style={[styles.composerArea, styles.optionsBar, { paddingBottom: Math.max(composerBottomInset, 12) }]}>{currentBlock.options.map(option => <TouchableOpacity key={option} style={styles.optionChip} onPress={() => submitAnswer(option, false)} activeOpacity={0.8}><Text style={styles.optionChipText}>{option}</Text></TouchableOpacity>)}</View>
          : currentBlock ? <View onLayout={(event) => { setComposerHeight(event.nativeEvent.layout.height); setComposerTop(event.nativeEvent.layout.y); }} style={[styles.composerArea, { paddingBottom: Math.max(composerBottomInset, 16) }]}><MessageComposer value={inputValue} onChangeText={setInputValue} onFocus={() => setInputFocused(true)} placeholder="Você pode escrever ou falar ..." onSubmit={handleSubmit} submitLabel="Enviar resposta" voice={<VoiceInput onCapture={handleVoiceCapture} onPartialResult={setInputValue} disabled={isTyping} appearance="onboarding" />} />{currentBlock.optional && !inputValue.trim() && <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}><Text style={styles.skipBtnText}>Pular esta pergunta</Text></TouchableOpacity>}</View> : null}
        </View>
      </KeyboardAvoidingView>
      <Modal
        visible={restartConfirmationVisible || skipAiConfirmationVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeConfirmation}
      >
        <View style={styles.confirmationOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeConfirmation}
            accessibilityLabel="Fechar confirmação"
          />
          <View style={[styles.confirmationCard, { marginTop: insets.top / 2, marginBottom: insets.bottom / 2 }]} accessibilityRole="alert">
            <View style={styles.confirmationIcon}>
              <Ionicons name={skipAiConfirmationVisible ? 'sparkles-outline' : 'refresh'} size={25} color="#07856D" />
            </View>
            <Text style={styles.confirmationTitle}>{skipAiConfirmationVisible ? 'Continuar sem IA?' : 'Recomeçar do início?'}</Text>
            <Text style={styles.confirmationMessage}>
              {skipAiConfirmationVisible ? 'Sem configurar a IA agora, o Lumio não conseguirá gerar automaticamente a personalização inicial do seu negócio. Você ainda poderá configurar sua chave depois.' : 'Seu progresso nesta conversa será apagado. Quer voltar à apresentação e começar de novo?'}
            </Text>
            {!!saveError && skipAiConfirmationVisible && <Text style={styles.confirmationMessage}>{saveError}</Text>}
            <TouchableOpacity
              style={styles.confirmationPrimary}
              disabled={saving}
              onPress={skipAiConfirmationVisible ? finishWithoutAi : confirmRestartOnboarding}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmationPrimaryText}>{skipAiConfirmationVisible ? (saving ? 'Salvando...' : 'Continuar sem IA') : 'Recomeçar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmationSecondary}
              onPress={closeConfirmation}
              activeOpacity={0.75}
            >
              <Text style={styles.confirmationSecondaryText}>{skipAiConfirmationVisible ? "Voltar e configurar" : "Continuar"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );

}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3FFF9' }, flex: { flex: 1 }, scrollContent: { flexGrow: 1, backgroundColor: '#F3FFF9' },
  hero: { width: '100%', overflow: 'hidden', backgroundColor: '#EAF8EE' }, heroImage: { width: '100%', height: '100%' },
  headerVeil: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
  heroCurve: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 74 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, gap: 10 },
  headerCenter: { flex: 1, minWidth: 0, paddingTop: 1 }, headerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, lineHeight: 21, color: '#202B38' },
  progressRow: { flexDirection: 'row', gap: 5, marginTop: 9 }, progressSegment: { flex: 1, height: 8, borderRadius: 9, backgroundColor: 'rgba(213,232,224,0.88)' }, progressActive: { backgroundColor: '#079D80' },
  conversation: { flex: 1, minHeight: 210, paddingTop: 12, paddingBottom: 100 }, waves: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 150 },
  messageStack: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 4, paddingHorizontal: 20 },
  messageStackTop: { justifyContent: 'flex-start' },
  messageContent: { width: '100%', alignItems: 'center', gap: 4 },
  keyboardContrast: { position: 'absolute', top: -24, bottom: -24, left: -20, right: -20, borderRadius: 40, overflow: 'hidden' },
  confirmationOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(18, 39, 32, 0.42)' },
  confirmationCard: {
      ...SurfaceStyles.overlay,
    width: '100%', maxWidth: 360, alignItems: 'center', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 18, borderRadius: 28 },
  confirmationIcon: { width: 54, height: 54, marginBottom: 16, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F7F1' },
  confirmationTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 19, lineHeight: 26, textAlign: 'center', color: '#202B38' },
  confirmationMessage: { marginTop: 9, marginBottom: 22, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', color: '#62736E' },
  confirmationPrimary: { width: '100%', minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 25, backgroundColor: '#00A878' },
  confirmationPrimaryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, lineHeight: 20, color: '#FFFFFF' },
  confirmationSecondary: { width: '100%', minHeight: 46, marginTop: 6, alignItems: 'center', justifyContent: 'center' },
  confirmationSecondaryText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, lineHeight: 20, color: '#087E68' },
  composerArea: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, paddingHorizontal: 18, paddingTop: 14, backgroundColor: '#F3FFF9', borderTopLeftRadius: 44, borderTopRightRadius: 44 },
  sendBtnDisabled: { backgroundColor: Colors.accentDisabled, shadowOpacity: 0.035 },
  startBtn: { height: 54, borderRadius: 30, backgroundColor: '#00A878', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, startBtnText: { fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF', fontSize: 16 },
  optionsBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, optionChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, backgroundColor: '#00A878' }, optionChipText: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#FFFFFF', fontSize: 15, lineHeight: 20 },
  skipBtn: { alignSelf: 'center', paddingVertical: 8 }, skipBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#087E68', fontSize: 14, lineHeight: 20 },
});
