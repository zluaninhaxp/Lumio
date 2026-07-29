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
import { Colors, Radius, FontSize, Spacing } from '../../../src/constants/theme';

interface VoiceRecorderProps {
  onRecordingComplete: (uri: string) => void;
  disabled?: boolean;
}

export default function VoiceRecorder({ onRecordingComplete, disabled = false }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<any>(null);
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
      const { Audio } = await import('expo-av');

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão necessária',
          'Precisamos de acesso ao microfone para gravar sua resposta.',
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      startPulse();
    } catch {
      Alert.alert('Erro', 'Não foi possível iniciar a gravação.');
    }
  }, [startPulse]);

  const stopRecording = useCallback(async () => {
    try {
      const recording = recordingRef.current;
      if (!recording) return;

      setIsRecording(false);
      stopPulse();

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;

      if (uri) {
        onRecordingComplete(uri);
      }
    } catch {
      setIsRecording(false);
      stopPulse();
    }
  }, [onRecordingComplete, stopPulse]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    startRecording();
  }, [disabled, startRecording]);

  const handlePressOut = useCallback(() => {
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
