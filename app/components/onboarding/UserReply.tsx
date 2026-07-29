import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';

interface UserReplyProps {
  text: string;
  isVoice?: boolean;
}

/**
 * Mostra a última resposta do usuário como um pequeno cartão/chip logo
 * abaixo do balão do mascote — não é uma bolha de chat, é uma confirmação
 * do que foi dito antes de o mascote reagir.
 */
export default function UserReply({ text, isVoice }: UserReplyProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    translateY.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <View style={styles.chip}>
        {isVoice && <Ionicons name="mic" size={13} color="#FFFFFF" style={styles.icon} />}
        <Text style={styles.text} numberOfLines={3}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    borderBottomRightRadius: 4,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    maxWidth: '85%',
  },
  icon: { marginRight: 2 },
  text: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    lineHeight: 20,
  },
});
