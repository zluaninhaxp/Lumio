import { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Image,
  TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../src/constants/theme';
import { parseMessage, buildBotResponse } from '../../src/engine/regexEngine';
import { useAppStore } from '../../src/store';
import VoiceInput from '../components/onboarding/VoiceInput';
import { MASCOT_IMAGES } from '../../src/data/mascotExpressions';

interface Message {
  id: string;
  type: 'user' | 'bot' | 'fallback';
  text: string;
  actions?: string[];
  timestamp: Date;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '0',
    type: 'bot',
    text: 'Olá! Pode digitar qualquer coisa aqui — gastos, tarefas, compromissos. Eu cuido do resto. 👋',
    timestamp: new Date(),
  },
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const { addTransaction, addTask, addEvent } = useAppStore();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      type: 'user',
      text,
      timestamp: new Date(),
    };

    const parsed = parseMessage(text);
    const botText = buildBotResponse(parsed);

    let actions: string[] = [];
    let botType: 'bot' | 'fallback' = 'bot';

    if (parsed.intent === 'UNKNOWN') {
      botType = 'fallback';
    } else if (parsed.intent === 'EXPENSE_RECORD' || parsed.intent === 'INCOME_RECORD') {
      actions = ['Editar', 'Excluir'];
      if (parsed.intent === 'EXPENSE_RECORD') {
        addTransaction({
          date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          description: parsed.entities.description || 'Despesa',
          amount: -(parsed.entities.value || 0),
          category: parsed.entities.category || 'Outros',
        });
      } else {
        addTransaction({
          date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          description: parsed.entities.description || 'Receita',
          amount: parsed.entities.value || 0,
          category: 'Receita',
        });
      }
    } else if (parsed.intent === 'TASK_ADD') {
      actions = ['Concluir'];
      addTask({ description: parsed.entities.description || '', done: false, dueDate: null });
    } else if (parsed.intent === 'TASK_WITH_DATE') {
      actions = ['Concluir'];
      addEvent({
        date: new Date().toISOString().split('T')[0],
        time: null,
        description: parsed.entities.description || '',
        done: false,
      });
    }

    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      type: botType,
      text: botText,
      actions,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
    scrollToBottom();
  }, [input]);

  const handleVoiceCapture = useCallback((transcript: string) => {
    if (!transcript.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: transcript.trim(),
      timestamp: new Date(),
    };

    const parsed = parseMessage(transcript.trim());
    const botText = buildBotResponse(parsed);

    let actions: string[] = [];
    let botType: 'bot' | 'fallback' = 'bot';

    if (parsed.intent === 'UNKNOWN') {
      botType = 'fallback';
    } else if (parsed.intent === 'EXPENSE_RECORD' || parsed.intent === 'INCOME_RECORD') {
      actions = ['Editar', 'Excluir'];
      if (parsed.intent === 'EXPENSE_RECORD') {
        addTransaction({
          date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          description: parsed.entities.description || 'Despesa',
          amount: -(parsed.entities.value || 0),
          category: parsed.entities.category || 'Outros',
        });
      } else {
        addTransaction({
          date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          description: parsed.entities.description || 'Receita',
          amount: parsed.entities.value || 0,
          category: 'Receita',
        });
      }
    } else if (parsed.intent === 'TASK_ADD') {
      actions = ['Concluir'];
      addTask({ description: parsed.entities.description || '', done: false, dueDate: null });
    } else if (parsed.intent === 'TASK_WITH_DATE') {
      actions = ['Concluir'];
      addEvent({
        date: new Date().toISOString().split('T')[0],
        time: null,
        description: parsed.entities.description || '',
        done: false,
      });
    }

    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      type: botType,
      text: botText,
      actions,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
    scrollToBottom();
  }, [scrollToBottom, addTransaction, addTask, addEvent]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isTransactionReport = item.actions?.some((a) => a === 'Editar' || a === 'Excluir');

    const renderBotAvatar = (expression: 'neutro' | 'confuso' | 'piscando') => (
      <Image source={MASCOT_IMAGES[expression]} style={styles.botAvatarImage} resizeMode="contain" />
    );

    if (item.type === 'user') {
      return (
        <View style={styles.userBubbleContainer}>
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{item.text}</Text>
          </View>
        </View>
      );
    }

    if (item.type === 'fallback') {
      return (
        <View style={styles.botRow}>
          {renderBotAvatar('confuso')}
          <View style={styles.botContent}>
            <View style={styles.botBubble}>
              <Text style={styles.botText}>
                Não consegui identificar o que você quer registrar. O que você quer fazer?
              </Text>
            </View>
            <View style={styles.quickActionsRow}>
              {['Registrar gasto', 'Adicionar tarefa', 'Outra coisa'].map((label) => (
                <TouchableOpacity key={label} style={styles.quickActionBtn}>
                  <Text style={styles.quickActionText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.botRow}>
        {renderBotAvatar(isTransactionReport ? 'piscando' : 'neutro')}
        <View style={styles.botContent}>
          <View style={styles.botBubble}>
            <Text style={styles.botText}>{item.text}</Text>
          </View>
          {item.actions && item.actions.length > 0 && (
            <View style={styles.actionsRow}>
              {item.actions.map((action) => (
                <TouchableOpacity key={action} style={styles.actionBtn}>
                  <Text style={styles.actionText}>{action}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={require('../../assets/lumio.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>OJ</Text>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrapper}>
            {!input && (
              <Text
                style={styles.inputPlaceholder}
                numberOfLines={1}
                ellipsizeMode="tail"
                pointerEvents="none"
              >
                Digite aqui...
              </Text>
            )}
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholderTextColor="transparent"
              onSubmitEditing={handleSend}
              returnKeyType="send"
              numberOfLines={1}
            />
          </View>
          <VoiceInput
            onCapture={handleVoiceCapture}
            onPartialResult={setInput}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim()}
          >
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
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
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerLogo: {
    width: 98,
    height: 30,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
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
    marginTop: 2,
    overflow: 'hidden',
  },
  botAvatarImage: {
    width: 36,
    height: 36,
    marginTop: 2,
  },
  botContent: { flex: 1, gap: Spacing.xs },
  botBubble: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderTopLeftRadius: 4,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignSelf: 'flex-start',
    maxWidth: '90%',
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

  actionsRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  actionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  actionText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  quickActionsRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  quickActionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    backgroundColor: Colors.bgCard,
  },
  quickActionText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
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
});
