import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView,
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

interface Msg {
  id: string;
  type: 'bot' | 'user';
  text: string;
}

const BLOCK_COUNT = OPEN_QUESTIONS.length;
const TOTAL_STAGES = 4;

export default function OnboardingScreen() {
  const router = useRouter();
  const applyOpenOnboardingConfig = useAppStore((s) => s.applyOpenOnboardingConfig);
  const insets = useSafeAreaInsets();

  const blockIndexRef = useRef(0);
  const answersRef = useRef<OpenOnboardingAnswers>({});
  const followUpUsedRef = useRef<Record<string, boolean>>({});
  const isEditingRef = useRef(false);
  const pushedBlocksRef = useRef<Set<string>>(new Set());
  // Conta quantas vezes o usuário já enviou uma resposta para o bloco atual
  // (1ª tentativa, resposta ao follow-up, nova tentativa após editar, etc.)
  // Cada tentativa precisa de um id de mensagem único — sem isso, a 2ª
  // resposta do mesmo bloco (por ex. depois do follow-up) usava sempre o
  // mesmo id da 1ª e o balão do usuário simplesmente não aparecia na tela.
  const attemptCountRef = useRef<Record<string, number>>({});

  const [blockIndex, setBlockIndex] = useState(0);
  const [answers, setAnswers] = useState<OpenOnboardingAnswers>({});
  const [messages, setMessages] = useState<Msg[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [botTyping, setBotTyping] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
  }, []);

  const pushBotMsg = useCallback((id: string, text: string) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === id)) return prev;
      return [...prev, { id, type: 'bot', text }];
    });
  }, []);

  const pushUserMsg = useCallback((id: string, text: string) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === id)) return prev;
      return [...prev, { id, type: 'user', text }];
    });
  }, []);

  // Mostra um pequeno indicador de "digitando" antes de cada mensagem do bot,
  // e intercala as mensagens de uma lista uma por vez — evita que uma
  // transição + pergunta apareçam de uma vez só, o que parecia um despejo de
  // texto em vez de uma conversa.
  const queueBotMessages = useCallback((msgs: { id: string; text: string }[]) => {
    let i = 0;
    const step = () => {
      if (i >= msgs.length) {
        setBotTyping(false);
        return;
      }
      setBotTyping(true);
      setTimeout(() => {
        setBotTyping(false);
        pushBotMsg(msgs[i].id, msgs[i].text);
        i += 1;
        setTimeout(step, 150);
      }, 550);
    };
    step();
  }, [pushBotMsg]);

  const enterBlock = useCallback((index: number) => {
    const block = OPEN_QUESTIONS[index];
    const baseKey = block.id;

    if (!pushedBlocksRef.current.has(baseKey)) {
      const msgs: { id: string; text: string }[] = [];
      if (block.transition) msgs.push({ id: `${baseKey}-transition`, text: block.transition });
      msgs.push({ id: `${baseKey}-question`, text: block.question });
      queueBotMessages(msgs);
      pushedBlocksRef.current.add(baseKey);
    }
  }, [queueBotMessages]);

  // Entra no primeiro bloco na montagem
  useEffect(() => {
    enterBlock(0);
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll ao adicionar mensagens
  useEffect(() => {
    scrollToBottom();
  }, [messages, botTyping, scrollToBottom]);

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
      pushBotMsg('summary-message', 'Prontinho! Veja abaixo um resumo do que você me contou. Se quiser ajustar alguma resposta, é só tocar em "Editar".');
    } else {
      setBlockIndex(next);
      blockIndexRef.current = next;
      enterBlock(next);
    }
  }, [enterBlock, pushBotMsg]);

  const handleSkip = useCallback(() => {
    const currentIndex = blockIndexRef.current;
    const block = OPEN_QUESTIONS[currentIndex];
    if (!block?.optional) return;

    pushUserMsg(`${block.id}-skip`, '(pulou esta pergunta)');
    setInputValue('');
    advanceFromBlock(currentIndex);
  }, [advanceFromBlock, pushUserMsg]);

  const handleSubmit = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;
    if (showSummary) return;

    const currentIndex = blockIndexRef.current;
    const block = OPEN_QUESTIONS[currentIndex];
    const attempt = (attemptCountRef.current[block.id] ?? 0) + 1;
    attemptCountRef.current[block.id] = attempt;
    const answerKey = `${block.id}-answer-${isEditingRef.current ? 'edit' : 'main'}-${attempt}`;

    pushUserMsg(answerKey, text);
    setInputValue('');

    const newAnswers = { ...answersRef.current, [block.id]: text };
    answersRef.current = newAnswers;
    setAnswers(newAnswers);

    const isShort = text.length < block.minLengthForFollowUp;
    const alreadyFollowedUp = followUpUsedRef.current[block.id];

    if (isShort && !alreadyFollowedUp) {
      followUpUsedRef.current[block.id] = true;
      const fuKey = `${block.id}-followup`;
      queueBotMessages([{ id: fuKey, text: block.followUp }]);
      return;
    }

    // Avança
    advanceFromBlock(currentIndex);
  }, [inputValue, showSummary, pushUserMsg, advanceFromBlock]);

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

    const block = OPEN_QUESTIONS[index];
    const msgs: { id: string; text: string }[] = [];
    if (block.transition) msgs.push({ id: `${blockId}-transition-edit`, text: block.transition });
    msgs.push({ id: `${blockId}-question-edit`, text: block.question });
    queueBotMessages(msgs);
  }, [pushBotMsg, queueBotMessages]);

  const handleFinish = useCallback(() => {
    applyOpenOnboardingConfig(answersRef.current);
    router.replace('/celebration');
  }, [applyOpenOnboardingConfig, router]);

  const currentBlock = blockIndex < BLOCK_COUNT ? OPEN_QUESTIONS[blockIndex] : null;
  const stage = currentBlock?.stage ?? TOTAL_STAGES;
  const businessType = guessBusinessTypeFallback(answersRef.current);
  const businessName = guessBusinessNameFallback(answersRef.current);

  const renderMessage = ({ item }: { item: Msg }) => {
    if (item.type === 'user') {
      return (
        <View style={styles.userBubbleContainer}>
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{item.text}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.botRow}>
        <View style={styles.botAvatar}>
          <Text style={styles.botAvatarText}>L</Text>
        </View>
        <View style={styles.botBubble}>
          <Text style={styles.botText}>{item.text}</Text>
        </View>
      </View>
    );
  };

  if (showSummary) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Configurando seu Lumio</Text>
          <Text style={styles.headerStage}>{TOTAL_STAGES} de {TOTAL_STAGES}</Text>
        </View>
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STAGES }).map((_, i) => (
            <View key={i} style={[styles.progressSegment, styles.progressSegmentActive]} />
          ))}
        </View>

        <ScrollView
          style={styles.summaryScroll}
          contentContainerStyle={{
            paddingHorizontal: Spacing.xl,
            paddingBottom: Spacing.xxl + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
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
        <Text style={styles.headerTitle}>Configurando seu Lumio</Text>
        <Text style={styles.headerStage}>
          {Math.min(stage, TOTAL_STAGES)} de {TOTAL_STAGES}
        </Text>
      </View>
      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STAGES }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressSegment,
              i < stage && styles.progressSegmentActive,
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={[styles.flex, { paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.messagesList,
            { paddingBottom: Spacing.xl + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          ListFooterComponent={
            botTyping ? (
              <View style={styles.botRow}>
                <View style={styles.botAvatar}>
                  <Text style={styles.botAvatarText}>L</Text>
                </View>
                <View style={[styles.botBubble, styles.typingBubble]}>
                  <Text style={styles.typingDots}>•••</Text>
                </View>
              </View>
            ) : null
          }
        />

        {currentBlock && (
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={currentBlock.placeholder}
              placeholderTextColor={Colors.textMuted}
              onSubmitEditing={handleSubmit}
              returnKeyType="send"
              multiline
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

  progressRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
  },
  progressSegmentActive: {
    backgroundColor: Colors.accent,
  },

  messagesList: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },

  userBubbleContainer: { alignItems: 'flex-end', marginVertical: Spacing.xs },
  userBubble: {
    backgroundColor: Colors.bubbleUser,
    borderRadius: Radius.lg,
    borderBottomRightRadius: 4,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    maxWidth: '80%',
  },
  userText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: '#FFFFFF',
    lineHeight: 22,
  },

  botRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  botAvatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  botBubble: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderBottomLeftRadius: 4,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignSelf: 'flex-start',
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  botText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    lineHeight: 22,
  },
  typingBubble: { paddingVertical: Spacing.sm },
  typingDots: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md,
    color: Colors.textMuted,
    letterSpacing: 2,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
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
    maxHeight: 120,
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
  summaryThankYou: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
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
