import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
import Mascot from './components/onboarding/Mascot';
import SpeechBubble from './components/onboarding/SpeechBubble';
import UserReply from './components/onboarding/UserReply';
import VoiceInput from './components/onboarding/VoiceInput';
import StageProgress from './components/onboarding/StageProgress';

const BLOCK_COUNT = OPEN_QUESTIONS.length;
const TOTAL_STAGES = 4;

interface Line {
  key: string;
  text: string;
  expression: MascotExpressionKey;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const applyOpenOnboardingConfig = useAppStore((s) => s.applyOpenOnboardingConfig);
  const { isAuthenticated, loading } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

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

  const mascotImage = MASCOT_IMAGES[currentLine?.expression ?? 'neutro'];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {!showIntro && (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              Configurando seu Lumio
            </Text>
            <Text style={styles.headerStage}>
              {Math.min(stage, TOTAL_STAGES)} de {TOTAL_STAGES}
            </Text>
          </View>
          <StageProgress totalStages={TOTAL_STAGES} currentStage={stage} />
        </>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.stageArea}>
          <Mascot image={mascotImage} bump={!isTyping} size={200} />

          <View style={styles.bubbleArea}>
            {isTyping ? (
              <SpeechBubble text="•••" animationKey="typing" />
            ) : currentLine ? (
              <SpeechBubble text={currentLine.text} animationKey={currentLine.key} />
            ) : null}
          </View>

          {lastUserReply && (
            <UserReply text={lastUserReply.text} isVoice={lastUserReply.isVoice} />
          )}
        </View>

        {showIntro && (
          <View style={[styles.inputBar, { paddingBottom: Spacing.md + insets.bottom }]}>
            <TouchableOpacity
              style={[styles.sendBtn, styles.startBtn, !introFinished && styles.sendBtnDisabled]}
              onPress={handleStart}
              disabled={!introFinished}
              activeOpacity={0.85}
            >
              <Text style={styles.startBtnText}>Vamos lá</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {!showIntro && currentBlock && currentBlock.options ? (
          <View style={[styles.optionsBar, { paddingBottom: Spacing.md + insets.bottom }]}>
            {currentBlock.options.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.optionChip}
                onPress={() => submitAnswer(option, false)}
                activeOpacity={0.8}
              >
                <Text style={styles.optionChipText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (!showIntro && currentBlock && (
          <View style={[styles.inputBar, { paddingBottom: Spacing.md + insets.bottom }]}>
            <View style={styles.inputWrapper}>
              {!inputValue && (
                <Text
                  style={styles.inputPlaceholder}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  pointerEvents="none"
                >
                  Você pode escrever ou falar comigo
                </Text>
              )}
              <TextInput
                style={styles.input}
                value={inputValue}
                onChangeText={setInputValue}
                placeholderTextColor="transparent"
                onSubmitEditing={handleSubmit}
                returnKeyType="send"
                numberOfLines={1}
              />
            </View>
            <VoiceInput
              onCapture={handleVoiceCapture}
              onPartialResult={setInputValue}
              disabled={isTyping}
            />
            {currentBlock.optional && !inputValue.trim() ? (
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
                <Text style={styles.skipBtnText}>Pular</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.sendBtn, !inputValue.trim() && styles.sendBtnDisabled]}
                onPress={handleSubmit}
                disabled={!inputValue.trim()}
              >
                <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.lg,
    color: Colors.primary,
  },
  headerStage: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },

  stageArea: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  bubbleArea: {
    minHeight: 90,
    justifyContent: 'flex-start',
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  inputPlaceholder: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.textMuted },
  startBtn: {
    flex: 1,
    flexDirection: 'row',
    width: undefined,
    height: 48,
    borderRadius: Radius.full,
    gap: Spacing.sm,
  },
  startBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md,
    color: '#FFFFFF',
  },
  optionsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  optionChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  optionChipText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.md,
    color: '#FFFFFF',
  },
  skipBtn: {
    height: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
