import { useEffect, useRef, useState } from 'react';
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
  const [speechUnavailable, setSpeechUnavailable] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [speechModule, setSpeechModule] = useState<
    typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule | null
  >(null);
  const speechModuleRef = useRef<
    typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule | null
  >(null);
  const onCaptureRef = useRef(onCapture);
  const onPartialResultRef = useRef(onPartialResult);

  useEffect(() => {
    onCaptureRef.current = onCapture;
    onPartialResultRef.current = onPartialResult;
  }, [onCapture, onPartialResult]);

  // Expo Go (and old standalone APKs) do not contain third-party native
  // modules. Load this one lazily so text onboarding remains usable there.
  useEffect(() => {
    let mounted = true;
    import('expo-speech-recognition')
      .then(({ ExpoSpeechRecognitionModule }) => {
        if (mounted) {
          speechModuleRef.current = ExpoSpeechRecognitionModule;
          setSpeechModule(ExpoSpeechRecognitionModule);
        }
      })
      .catch(() => {
        if (mounted) setSpeechUnavailable(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const module = speechModule;
    if (!module) return;
    const subscriptions = [
      module.addListener('start', () => {
        setIsRecording(true);
        onPartialResultRef.current?.('');
      }),
      module.addListener('result', (event) => {
        const transcript = event.results[0]?.transcript ?? '';
        setPartialTranscript(transcript);
        onPartialResultRef.current?.(transcript);
      }),
      module.addListener('end', () => {
        setIsRecording(false);
        setPartialTranscript((finalText) => {
          if (finalText.trim()) onCaptureRef.current(finalText.trim());
          return '';
        });
      }),
      module.addListener('error', (event) => {
        setIsRecording(false);
        if (event.error === 'not-allowed') setPermissionDenied(true);
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [speechModule]);

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

  const handlePress = async () => {
    if (disabled) return;

    const module = speechModuleRef.current;
    if (!module) {
      setSpeechUnavailable(true);
      return;
    }

    if (isRecording) {
      module.stop();
      return;
    }

    const permission = await module.requestPermissionsAsync();
    if (!permission.granted) {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);

    module.start({
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
      {speechUnavailable && (
        <Text style={styles.permissionText}>
          Voz indisponível neste APK. Digite sua resposta ou instale um development build com o módulo nativo.
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
