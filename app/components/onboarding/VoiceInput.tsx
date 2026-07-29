import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Colors, Radius } from '../../../src/constants/theme';

interface VoiceInputProps {
  /** Chamado com o texto final transcrito pelo reconhecimento nativo do aparelho. */
  onCapture: (transcript: string) => void;
  /** Chamado a cada atualização parcial, enquanto o usuário ainda está falando. */
  onPartialResult?: (transcript: string) => void;
  disabled?: boolean;
}

/**
 * Botão de microfone com transcrição por voz 100% nativa do aparelho
 * (SFSpeechRecognizer no iOS, SpeechRecognizer/RecognizerIntent no Android),
 * via `expo-speech-recognition`. Não grava arquivo de áudio nem chama IA —
 * o texto final já sai pronto para ser salvo como resposta.
 *
 * Observação: por ser um módulo nativo, só funciona em um dev build
 * (não funciona no Expo Go).
 */
export default function VoiceInput({ onCapture, onPartialResult, disabled }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');

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

  useSpeechRecognitionEvent('start', () => {
    setIsRecording(true);
    onPartialResult?.('');
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    setPartialTranscript(transcript);
    onPartialResult?.(transcript);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsRecording(false);
    setPartialTranscript((finalText) => {
      if (finalText.trim()) onCapture(finalText.trim());
      return '';
    });
  });

  useSpeechRecognitionEvent('error', (event) => {
    setIsRecording(false);
    if (event.error === 'not-allowed') setPermissionDenied(true);
  });

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const handlePress = async () => {
    if (disabled) return;

    if (isRecording) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);

    ExpoSpeechRecognitionModule.start({
      lang: 'pt-BR',
      interimResults: true,
      continuous: false,
    });
  };

  return (
    <View style={styles.container}>
      <Animated.View style={pulseStyle}>
        <TouchableOpacity
          style={[
            styles.micBtn,
            isRecording && styles.micBtnRecording,
            disabled && styles.micBtnDisabled,
          ]}
          onPress={handlePress}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={20}
            color={isRecording ? '#FFFFFF' : Colors.accent}
          />
        </TouchableOpacity>
      </Animated.View>
      {permissionDenied && (
        <Text style={styles.permissionText}>
          Preciso de acesso ao microfone/reconhecimento de fala para ouvir sua resposta.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  micBtnRecording: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  micBtnDisabled: {
    opacity: 0.4,
  },
  permissionText: {
    position: 'absolute',
    top: 50,
    width: 180,
    fontSize: 11,
    color: Colors.danger,
    textAlign: 'center',
  },
});
