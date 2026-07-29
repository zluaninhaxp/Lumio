import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius, FontSize } from '../src/constants/theme';
import { useAppStore } from '../src/store';
import {
  OPEN_QUESTIONS,
  OpenOnboardingAnswers,
  guessBusinessTypeFallback,
  guessBusinessNameFallback,
} from '../src/engine/openOnboardingEngine';
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
  const insets = useSafeAreaInsets();

  const blockIndexRef = useRef(0);
  const answersRef = useRef<OpenOnboardingAnswers>({});
  const followUpUsedRef = useRef<Record<string, boolean>>({});
  const isEditingRef = useRef(false);
  const pushedBlocksRef = useRef<Set<string>>(new Set());
  const attemptCountRef = useRef<Record<string, number>>({});
  const queueTokenRef = useRef(0);

  const [blockIndex, setBlockIndex] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  const [isTyping, setIsTyping] = useState(false);
  const [currentLine, setCurrentLine] = useState<Line | null>(null);
  const [lastUserReply, setLastUserReply] = useState<{ text: string; isVoice?: boolean } | null>(null);

  // Encadeia as falas do mascote uma de cada vez, com uma pequena pausa de
  // "pensando" entre elas — dá a sensação de conversa guiada em vez de
  // despejar todo o texto de uma vez.
  const queueLines = useCallback((lines: Line[]) => {
    const token = ++queueTokenRef.current;
    setLastUserReply(null);
    let i = 0;
    const step = () => {
      if (queueTokenRef.current !== token) return;
      if (i >= lines.length) {
        setIsTyping(false);
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
    pushedBlocksRef.current.add(block.id);
  }, [queueLines]);

  useEffect(() => {
    enterBlock(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advanceFromBlock = useCallback((currentIndex: number) => {
    if (isEditingRef.current) {
      isEditingRef.current = false;
      setEditingBlockId(null);
      setShowSummary(true);
      setBlockIndex(BLOCK_COUNT);
      blockIndexRef.current = BLOCK_COUNT;
      return;
    }

    const next = currentIndex + 1;
    if (next >= BLOCK_COUNT) {
      setShowSummary(true);
      setBlockIndex(next);
      blockIndexRef.current = next;
      queueLines([{
        key: 'summary-message',
        text: 'Prontinho! Veja abaixo um resumo do que você me contou. Se quiser ajustar alguma resposta, é só tocar em "Editar".',
        expression: INTERACTION_MASCOT.summary,
      }]);
    } else {
      setBlockIndex(next);
      blockIndexRef.current = next;
      enterBlock(next);
    }
  }, [enterBlock, queueLines]);

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
    if (!text || showSummary) return;
    submitAnswer(text, false);
  }, [inputValue, showSummary, submitAnswer]);

  const handleVoiceCapture = useCallback((transcript: string) => {
    if (showSummary || !transcript.trim()) return;
    submitAnswer(transcript.trim(), true);
  }, [showSummary, submitAnswer]);

  const handleSkip = useCallback(() => {
    const currentIndex = blockIndexRef.current;
    const block = OPEN_QUESTIONS[currentIndex];
    if (!block?.optional) return;

    setLastUserReply({ text: '(pulou esta pergunta)' });
    setInputValue('');
    advanceFromBlock(currentIndex);
  }, [advanceFromBlock]);

  const handleEdit = useCallback((blockId: string) => {
    const index = OPEN_QUESTIONS.findIndex((q) => q.id === blockId);
    if (index === -1) return;

    delete followUpUsedRef.current[blockId];
    pushedBlocksRef.current.delete(blockId);

    const existingAnswer = answersRef.current[blockId] || '';
    setInputValue(existingAnswer);

    isEditingRef.current = true;
    setEditingBlockId(blockId);
    setShowSummary(false);
    setBlockIndex(index);
    blockIndexRef.current = index;

    enterBlock(index);
  }, [enterBlock]);

  const handleFinish = useCallback(() => {
    applyOpenOnboardingConfig(answersRef.current);
    router.replace('/celebration');
  }, [applyOpenOnboardingConfig, router]);

  const currentBlock = blockIndex < BLOCK_COUNT ? OPEN_QUESTIONS[blockIndex] : null;
  const stage = currentBlock?.stage ?? TOTAL_STAGES;
  const businessType = guessBusinessTypeFallback(answersRef.current);
  const businessName = guessBusinessNameFallback(answersRef.current);

  const mascotImage = MASCOT_IMAGES[currentLine?.expression ?? 'neutro'];

  if (showSummary) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Configurando seu Lumio</Text>
          <Text style={styles.headerStage}>{TOTAL_STAGES} de {TOTAL_STAGES}</Text>
        </View>
        <StageProgress totalStages={TOTAL_STAGES} currentStage={TOTAL_STAGES} />

        <ScrollView
          style={styles.summaryScroll}
          contentContainerStyle={{
            paddingHorizontal: Spacing.xl,
            paddingBottom: Spacing.xxl + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryMascotWrap}>
            <Mascot image={MASCOT_IMAGES[INTERACTION_MASCOT.summary]} size={140} />
          </View>

          <View style={styles.summaryThankYou}>
            <Ionicons name="heart-circle" size={32} color={Colors.accent} />
            <Text style={styles.summaryThankYouTitle}>
              Obrigado, {businessName}!
            </Text>
            <Text style={styles.summaryThankYouSub}>
              Detectamos que seu negócio se parece com{' '}
              <Text style={styles.summaryBadgeInline}>{businessType}</Text>.
              {'\n\n'}
              Confira abaixo as informações que você compartilhou.
            </Text>
          </View>

          {OPEN_QUESTIONS.map((block) => {
            const answer = answersRef.current[block.id];
            if (block.optional && !answer) return null;
            return (
              <View key={block.id} style={styles.answerCard}>
                <Text style={styles.answerQuestion}>{block.question}</Text>
                <Text style={styles.answerText}>
                  {answer || '(sem resposta)'}
                </Text>
                <TouchableOpacity
                  style={styles.answerEditBtn}
                  onPress={() => handleEdit(block.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={14} color={Colors.accent} />
                  <Text style={styles.answerEditLabel}>Editar</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.finishBtn}
            onPress={handleFinish}
            activeOpacity={0.85}
          >
            <Text style={styles.finishBtnText}>Confirmar e continuar</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {editingBlockId ? 'Editando resposta' : 'Configurando seu Lumio'}
        </Text>
        <Text style={styles.headerStage}>
          {Math.min(stage, TOTAL_STAGES)} de {TOTAL_STAGES}
        </Text>
      </View>
      <StageProgress totalStages={TOTAL_STAGES} currentStage={stage} />

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

        {currentBlock && (
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
        )}
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

  // Summary screen
  summaryScroll: { flex: 1 },
  summaryMascotWrap: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
  },
  summaryThankYou: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  summaryThankYouTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.xxl,
    color: Colors.primary,
    textAlign: 'center',
  },
  summaryThankYouSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  summaryBadgeInline: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: Colors.accent,
  },
  answerCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  answerQuestion: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  answerText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  answerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  answerEditLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
    color: Colors.accent,
  },

  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
  },
  finishBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md,
    color: '#FFFFFF',
  },
});
