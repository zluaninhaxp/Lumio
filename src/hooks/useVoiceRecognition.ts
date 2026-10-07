import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Linking } from 'react-native';
import { VoiceRecognition, type VoiceStatus } from '../services/voiceRecognition';

export function useVoiceRecognition(onCapture: (text: string) => void, onPartial?: (text: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>({ state: 'idle' });
  const controller = useRef<VoiceRecognition | null>(null);
  const callbacks = useRef({ onCapture, onPartial });
  callbacks.current = { onCapture, onPartial };
  const log = useCallback((detail: unknown) => {
    if (__DEV__) console.warn('[voice-recognition]', detail);
  }, []);
  useFocusEffect(useCallback(() => {
    let focused = true;
    setStatus({ state: 'idle' });
    // Expo Go has no native module. Loading it must not break manual input.
    import('expo-speech-recognition').then(({ ExpoSpeechRecognitionModule }) => {
      if (!focused) return;
      controller.current = new VoiceRecognition(ExpoSpeechRecognitionModule, setStatus,
        text => callbacks.current.onCapture(text), text => callbacks.current.onPartial?.(text), log);
    }).catch(error => {
      log(error);
      if (focused) setStatus({ state: 'unavailable', message: 'A voz não está disponível nesta versão do aplicativo.' });
    });
    return () => { focused = false; controller.current?.dispose(); controller.current = null; };
  }, [log]));
  const press = useCallback(() => { void controller.current?.press(); }, []);
  const openSettings = useCallback(() => {
    void Linking.openSettings().catch(error => {
      log(error);
      setStatus({ state: 'blocked', message: 'Abra as configurações do Lumio e permita o acesso ao microfone.' });
    });
  }, [log]);
  return { status, press, openSettings };
}
