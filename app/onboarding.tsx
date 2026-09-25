import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Image, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../src/constants/theme';
import { useAppStore } from '../src/store';
import { useAuth } from '../src/hooks/useAuth';
import {
  OPEN_QUESTIONS,
  OpenOnboardingAnswers,
} from '../src/engine/openOnboardingEngine';
import { ONBOARDING_INTRO } from '../src/data/onboardingQuestions';
import {
  MASCOT_IMAGES,
  BLOCK_MASCOT_EXPRESSION,
  INTERACTION_MASCOT,
  MascotExpressionKey,
} from '../src/data/mascotExpressions';
import Svg, { Path } from 'react-native-svg';
import LumioMessageAsset from './components/onboarding/LumioMessageAsset';
import SpeechBubble from './components/onboarding/SpeechBubble';
import UserReply from './components/onboarding/UserReply';
import VoiceInput from './components/onboarding/VoiceInput';
import StageProgress from './components/onboarding/StageProgress';

const BLOCK_COUNT = OPEN_QUESTIONS.length;
const TOTAL_STAGES = Math.max(...OPEN_QUESTIONS.map((question) => question.stage));

interface Line {
  key: string;
  text: string;
  expression: MascotExpressionKey;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const applyOpenOnboardingConfig = useAppStore((s) => s.applyOpenOnboardingConfig);
  const { isAuthenticated, currentUser, loading } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const heroHeight = Math.min(Math.max(height * 0.46, 260), 480);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    } else if (!loading && currentUser?.onboardingCompleted) {
      router.replace('/(tabs)/chat');
    }
  }, [loading, isAuthenticated, currentUser, router]);

  const blockIndexRef = useRef(0);
  const answersRef = useRef<OpenOnboardingAnswers>({});
  const followUpUsedRef = useRef<Record<string, boolean>>({});
  const attemptCountRef = useRef<Record<string, number>>({});
  const queueTokenRef = useRef(0);

  const [blockIndex, setBlockIndex] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [introFinished, setIntroFinished] = useState(false);
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

  const handleConfigureKey = useCallback(() => {
    router.push('/ai-settings');
  }, [router]);

  const advanceFromBlock = useCallback((currentIndex: number) => {
    const next = currentIndex + 1;
    if (next >= BLOCK_COUNT) {
      applyOpenOnboardingConfig(answersRef.current);
      router.replace('/celebration');
    } else {
      setBlockIndex(next);
      blockIndexRef.current = next;
      enterBlock(next);
    }
  }, [enterBlock, applyOpenOnboardingConfig, router]);

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
    submitAnswer(text, false);
  }, [inputValue, submitAnswer]);

  const handleVoiceCapture = useCallback((transcript: string) => {
    if (!transcript.trim()) return;
    submitAnswer(transcript.trim(), true);
  }, [submitAnswer]);

  const handleSkip = useCallback(() => {
    const currentIndex = blockIndexRef.current;
    const block = OPEN_QUESTIONS[currentIndex];
    if (!block?.optional) return;

    setLastUserReply({ text: '(pulou esta pergunta)' });
    setInputValue('');
    advanceFromBlock(currentIndex);
  }, [advanceFromBlock]);

  const currentBlock = blockIndex < BLOCK_COUNT ? OPEN_QUESTIONS[blockIndex] : null;
  const stage = currentBlock?.stage ?? TOTAL_STAGES;

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.flex}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={[styles.hero, { height: heroHeight + insets.top }]}>
              <Image source={require('../assets/onboarding-hero.png')} style={styles.heroImage} resizeMode="cover" />
              <LinearGradient pointerEvents="none" colors={['rgba(249,255,252,0.94)', 'rgba(249,255,252,0.68)', 'rgba(249,255,252,0)']} locations={[0, 0.45, 1]} style={styles.headerVeil} />
              <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                {!showIntro && <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Voltar"><Ionicons name="chevron-back" size={26} color="#087E68" /></TouchableOpacity>}
                <View style={styles.headerCenter}>
                  <Text style={styles.headerTitle}>Configurando seu Lumio</Text>
                  <View style={styles.progressRow}>{Array.from({ length: TOTAL_STAGES }).map((_, index) => <View key={index} style={[styles.progressSegment, index < stage && styles.progressActive]} />)}</View>
                </View>
                <TouchableOpacity style={styles.keyButton} onPress={handleConfigureKey} activeOpacity={0.8}><Ionicons name="sparkles" size={15} color="#168E76" /><Text style={styles.keyButtonText}>Chave de IA</Text></TouchableOpacity>
              </View>
              <View style={styles.heroCurve} pointerEvents="none"><Svg width={width} height={74} viewBox="0 0 400 74" preserveAspectRatio="none"><Path d="M0 35 C75 60 130 66 206 65 C293 64 349 43 400 5 L400 74 L0 74Z" fill="#F3FFF9" /></Svg></View>
            </View>
            <View style={styles.conversation}>
              <View pointerEvents="none" style={styles.waves}><Svg width={width} height={150} viewBox="0 0 400 150" preserveAspectRatio="none"><Path d="M0 47 C75 35 135 118 225 102 C305 88 330 30 400 15 L400 150 L0 150Z" fill="#D6F5E8" /><Path d="M0 76 C95 75 140 153 245 120 C316 101 340 117 400 91 L400 150 L0 150Z" fill="#78D5BA" /><Path d="M0 115 C80 88 135 144 220 137 C310 126 338 132 400 113 L400 150 L0 150Z" fill="#39B99A" /></Svg></View>
              <LumioMessageAsset messageKey={isTyping ? 'typing' : currentLine?.key ?? 'empty'} text={isTyping ? '...'  : currentLine?.text ?? ''} />
              {lastUserReply && <UserReply text={lastUserReply.text} isVoice={lastUserReply.isVoice} />}
            </View>
          </ScrollView>
          {showIntro ? <View style={[styles.composerArea, { paddingBottom: Math.max(insets.bottom, 12) }]}><TouchableOpacity style={[styles.startBtn, !introFinished && styles.sendBtnDisabled]} onPress={handleStart} disabled={!introFinished} activeOpacity={0.85}><Text style={styles.startBtnText}>Vamos lá</Text><Ionicons name="arrow-forward" size={20} color="#FFFFFF" /></TouchableOpacity></View>
          : currentBlock?.options ? <View style={[styles.composerArea, styles.optionsBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>{currentBlock.options.map(option => <TouchableOpacity key={option} style={styles.optionChip} onPress={() => submitAnswer(option, false)} activeOpacity={0.8}><Text style={styles.optionChipText}>{option}</Text></TouchableOpacity>)}</View>
          : currentBlock ? <View style={[styles.composerArea, { paddingBottom: Math.max(insets.bottom, 16) }]}><View style={styles.composerRow}><View style={styles.inputWrapper}><Ionicons name="attach-outline" size={21} color="#8C98A8" style={styles.attachIcon} /><TextInput style={styles.input} value={inputValue} onChangeText={setInputValue} placeholder="Você pode escrever ou falar ..." placeholderTextColor="#818C9C" onSubmitEditing={handleSubmit} returnKeyType="send" multiline maxLength={500} /><View style={styles.inputDivider} /><VoiceInput onCapture={handleVoiceCapture} onPartialResult={setInputValue} disabled={isTyping} appearance="onboarding" /></View><TouchableOpacity style={[styles.sendBtn, !inputValue.trim() && styles.sendBtnDisabled]} onPress={handleSubmit} disabled={!inputValue.trim()} accessibilityLabel="Enviar resposta"><Ionicons name="arrow-up" size={21} color="#FFFFFF" /></TouchableOpacity></View>{currentBlock.optional && !inputValue.trim() && <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}><Text style={styles.skipBtnText}>Pular esta pergunta</Text></TouchableOpacity>}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );

}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3FFF9' }, flex: { flex: 1 }, scrollContent: { flexGrow: 1, backgroundColor: '#F3FFF9' },
  hero: { width: '100%', overflow: 'hidden', backgroundColor: '#EAF8EE' }, heroImage: { width: '100%', height: '100%' },
  headerVeil: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
  heroCurve: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 74 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, gap: 10 },
  backButton: { width: 44, height: 44, borderRadius: 18, backgroundColor: 'rgba(246,255,251,0.82)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(216,241,231,0.9)', shadowColor: '#3D8C75', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  headerCenter: { flex: 1, minWidth: 0, paddingTop: 1 }, headerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, lineHeight: 21, color: '#202B38' },
  progressRow: { flexDirection: 'row', gap: 5, marginTop: 9 }, progressSegment: { flex: 1, height: 8, borderRadius: 9, backgroundColor: 'rgba(213,232,224,0.88)' }, progressActive: { backgroundColor: '#079D80' },
  keyButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 20, backgroundColor: 'rgba(247,255,251,0.72)', borderWidth: 1, borderColor: 'rgba(222,242,233,0.76)', shadowColor: '#3D8C75', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.045, shadowRadius: 8, elevation: 1 }, keyButtonText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: '#16816C' },
  conversation: { flex: 1, minHeight: 210, paddingTop: 12, paddingBottom: 54 }, waves: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 150 },
  composerArea: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, paddingHorizontal: 18, paddingTop: 14, backgroundColor: '#F3FFF9', borderTopLeftRadius: 44, borderTopRightRadius: 44 },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  inputWrapper: { flex: 1, minWidth: 0, minHeight: 46, flexDirection: 'row', alignItems: 'center', paddingLeft: 11, paddingRight: 5, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9EEE5' },
  attachIcon: { marginRight: 10 },
  input: { flex: 1, minWidth: 0, maxHeight: 100, minHeight: 42, paddingVertical: 9, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#202B38' }, inputDivider: { width: 1, height: 20, backgroundColor: '#DCECE6', marginHorizontal: 9 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#00A878', alignItems: 'center', justifyContent: 'center', shadowColor: '#007F64', shadowOpacity: 0.11, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, sendBtnDisabled: { backgroundColor: '#A9D9CA', shadowOpacity: 0.035 },
  startBtn: { height: 54, borderRadius: 30, backgroundColor: '#00A878', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, startBtnText: { fontFamily: 'PlusJakartaSans_700Bold', color: '#FFFFFF', fontSize: 16 },
  optionsBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, optionChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, backgroundColor: '#00A878' }, optionChipText: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#FFFFFF', fontSize: 14 },
  skipBtn: { alignSelf: 'center', paddingVertical: 8 }, skipBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#087E68', fontSize: 13 },
});
