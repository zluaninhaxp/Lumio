import { useEffect } from 'react';
import { useVoiceRecognition } from '../../../src/hooks/useVoiceRecognition';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { ControlOpacity, Colors, Radius } from '../../../src/constants/theme';

interface VoiceInputProps {
  /** Chamado com o texto final transcrito pelo reconhecimento nativo do aparelho. */
  onCapture: (transcript: string) => void;
  /** Chamado a cada atualização parcial, enquanto o usuário ainda está falando. */
  onPartialResult?: (transcript: string) => void;
  disabled?: boolean;
  appearance?: 'default' | 'onboarding';
}

/**
 * Botão de microfone com transcrição por voz 100% nativa do aparelho
 * (SFSpeechRecognizer no iOS, SpeechRecognizer/RecognizerIntent no Android),
 * via `expo-speech-recognition`. Não grava arquivo de áudio nem chama IA —
 * o texto final já sai pronto para ser salvo como resposta.
 *
 * Observação: por ser um módulo nativo, funciona em builds Android/iOS
 * (não funciona no Expo Go).
 */
export default function VoiceInput({ onCapture, onPartialResult, disabled, appearance = 'default' }: VoiceInputProps) {
  const { status, press, openSettings } = useVoiceRecognition(onCapture, onPartialResult);
  const isRecording = status.state === 'listening';
  const busy = ['permission', 'starting', 'processing'].includes(status.state);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isRecording) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.25, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 150 });
    }
    return () => cancelAnimation(pulse);
  }, [isRecording, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={pulseStyle}>
        <TouchableOpacity
          style={[
            styles.micTouchTarget,
          ]}
          accessibilityRole="button"
          accessibilityLabel={isRecording ? 'Parar gravação' : 'Falar mensagem'}
          accessibilityState={{ disabled: !!disabled || busy, selected: isRecording }}
          hitSlop={6}
          onPress={press}
          disabled={disabled || busy}
          activeOpacity={ControlOpacity.pressed}
        >
          <View style={[
            styles.micBtn,
            appearance === 'onboarding' && styles.micBtnOnboarding,
            isRecording && styles.micBtnRecording,
            disabled && styles.micBtnDisabled,
          ]}><Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={appearance === 'onboarding' ? 16 : 20}
            color={isRecording ? Colors.onAction : Colors.accentIcon}
          /></View>
        </TouchableOpacity>
      </Animated.View>
      {status.message && (
        <View style={styles.permissionText}>
          <Text style={{ fontSize: 11, color: Colors.dangerText, textAlign: 'center' }}>{status.message}</Text>
          {status.state === 'blocked' && (
            <TouchableOpacity activeOpacity={ControlOpacity.pressed} accessibilityRole="button" onPress={openSettings}>
              <Text style={{ fontSize: 12, color: Colors.accentText, textAlign: 'center' }}>Abrir configurações</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  micTouchTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.accentIcon,
  },
  micBtnOnboarding: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EAF8F2',
    borderWidth: 1,
    borderColor: '#DCF2E8',
  },
  micBtnRecording: {
    backgroundColor: Colors.dangerActionBackground,
    borderColor: Colors.dangerIcon,
  },
  micBtnDisabled: {
    opacity: 0.4,
  },
  permissionText: {
    position: 'absolute',
    top: 50,
    width: 180,
    fontSize: 11,
    color: Colors.dangerText,
    textAlign: 'center',
  },
});
