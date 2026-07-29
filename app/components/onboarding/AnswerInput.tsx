import { useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../../../src/constants/theme';
import VoiceRecorder from './VoiceRecorder';

interface AnswerInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder: string;
  isOptional?: boolean;
  onSkip?: () => void;
  onAudioRecorded?: (uri: string) => void;
}

export default function AnswerInput({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  isOptional = false,
  onSkip,
  onAudioRecorded,
}: AnswerInputProps) {
  const inputRef = useRef<TextInput>(null);
  const canSend = value.trim().length > 0;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    Keyboard.dismiss();
    onSubmit();
  }, [canSend, onSubmit]);

  const handleAudioComplete = useCallback((uri: string) => {
    onChangeText('[🎤 Mensagem de voz]');
    onAudioRecorded?.(uri);
  }, [onChangeText, onAudioRecorded]);

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        {onAudioRecorded && (
          <VoiceRecorder
            onRecordingComplete={handleAudioComplete}
            disabled={canSend}
          />
        )}

        <View style={styles.textInputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
            maxLength={500}
            textAlignVertical="center"
          />
        </View>

        {canSend && (
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSend}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {isOptional && !canSend && onSkip && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSkip}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Pular</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.hint}>
        Você pode escrever ou falar comigo 🎤
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  textInputWrapper: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
  },
  textInput: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    paddingVertical: Spacing.md,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    height: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  hint: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
