import { useRef, useState, useCallback } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  View,
  Text,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { Colors, Radius, FontSize, Spacing } from '../../../src/constants/theme';

interface VoiceRecorderProps {
  onRecordingComplete: (uri: string) => void;
  disabled?: boolean;
}

export default function VoiceRecorder({ onRecordingComplete, disabled = false }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const isPressingRef = useRef(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const pulse = useSharedValue(1);

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.3 + 0.7 * (1 - (pulse.value - 1) / 0.3),
  }));

  const startPulse = useCallback(() => {
    pulse.value = withRepeat(
      withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const stopPulse = useCallback(() => {
    cancelAnimation(pulse);
    pulse.value = withTiming(1, { duration: 200 });
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permissão necessária',
          'Ative o Microfone nas configurações do Lumio para gravar sua resposta.',
        );
        return;
      }

      // O diálogo de permissão pode encerrar o toque antes de responder.
      if (!isPressingRef.current) return;

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      startPulse();
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      Alert.alert('Erro', 'Não foi possível iniciar a gravação. Tente novamente.');
    }
  }, [recorder, startPulse]);

  const stopRecording = useCallback(async () => {
    try {
      if (!recorder.isRecording) return;

      setIsRecording(false);
      stopPulse();

      await recorder.stop();
      const uri = recorder.uri;

      if (uri) {
        onRecordingComplete(uri);
      }
    } catch {
      setIsRecording(false);
      stopPulse();
    }
  }, [onRecordingComplete, recorder, stopPulse]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    isPressingRef.current = true;
    startRecording();
  }, [disabled, startRecording]);

  const handlePressOut = useCallback(() => {
    isPressingRef.current = false;
    if (isRecording) {
      stopRecording();
    }
  }, [isRecording, stopRecording]);

  return (
    <View style={styles.container}>
      {isRecording && (
        <>
          <Animated.View style={[styles.pulseRing, pulseAnimatedStyle]} />
          <Text style={styles.recordingLabel}>Gravando...</Text>
        </>
      )}
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
        disabled={disabled}
        style={[
          styles.button,
          isRecording && styles.buttonRecording,
          disabled && styles.buttonDisabled,
        ]}
      >
        <Ionicons
          name={isRecording ? 'mic' : 'mic-outline'}
          size={22}
          color={isRecording ? '#FFFFFF' : Colors.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRecording: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  pulseRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.danger,
    zIndex: -1,
  },
  recordingLabel: {
    position: 'absolute',
    bottom: -22,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.xs,
    color: Colors.danger,
  },
});
