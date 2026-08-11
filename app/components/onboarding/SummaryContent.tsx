import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';
import {
  OPEN_QUESTIONS,
  OpenOnboardingAnswers,
  guessBusinessTypeFallback,
  guessBusinessNameFallback,
} from '../../../src/engine/openOnboardingEngine';
import MascotView from './MascotView';
import SpeechBubble from './SpeechBubble';

interface SummaryContentProps {
  answers: OpenOnboardingAnswers;
  onEdit: (blockId: string) => void;
  onConfirm: () => void;
}

export default function SummaryContent({ answers, onEdit, onConfirm }: SummaryContentProps) {
  const insets = useSafeAreaInsets();
  const buttonOpacity = useSharedValue(0);

  const businessType = guessBusinessTypeFallback(answers);
  const businessName = guessBusinessNameFallback(answers);

  useEffect(() => {
    buttonOpacity.value = withDelay(600, withTiming(1, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    }));
  }, []);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{
        paddingBottom: Spacing.xxxl + insets.bottom,
      }}
      showsVerticalScrollIndicator={false}
    >
      <MascotView stage={5} />

      <SpeechBubble
        text={`Obrigado, ${businessName}! 🎉\n\nSeu negócio se parece com ${businessType}. Confira abaixo as informações que você compartilhou. Se quiser ajustar algo, é só tocar em "Editar".`}
        animationKey="summary"
      />

      <View style={styles.answersSection}>
        {OPEN_QUESTIONS.map((block) => {
          const answer = answers[block.id];
          if (block.optional && !answer) return null;
          return (
            <View key={block.id} style={styles.answerCard}>
              <Text style={styles.answerQuestion}>{block.question}</Text>
              <Text style={styles.answerText}>
                {answer || '(sem resposta)'}
              </Text>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => onEdit(block.id)}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={14} color={Colors.accent} />
                <Text style={styles.editLabel}>Editar</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <Animated.View style={[styles.confirmWrapper, buttonAnimatedStyle]}>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={onConfirm}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmText}>Confirmar e continuar</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  answersSection: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  answerCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
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
  editButton: {
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
  editLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.xs,
    color: Colors.accent,
  },
  confirmWrapper: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: Spacing.lg,
  },
  confirmText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.md,
    color: '#FFFFFF',
  },
});
