import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { aiKeyService } from '../services/ai-key-service';
import { AIProviderError } from '../ai/aiProvider';

type KeyStatus = { userId: string | null; status: 'loading' | 'configured' | 'notConfigured' | 'error'; error?: string };

export function useAiKeyStatus(userId: string | null, enabled = true) {
  const [state, setState] = useState<KeyStatus>({ userId, status: 'loading' });
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setState({ userId, status: 'loading' });
    if (!userId) { setState({ userId, status: 'error', error: 'Entre na sua conta para configurar a IA.' }); return; }
    try {
      const configured = await aiKeyService.status(userId);
      if (request === sequence.current) setState({ userId, status: configured ? 'configured' : 'notConfigured' });
    } catch (error) {
      if (request === sequence.current) setState({ userId, status: 'error', error: error instanceof AIProviderError ? error.message : 'Não foi possível consultar a configuração de IA.' });
    }
  }, [userId]);
  useFocusEffect(useCallback(() => {
    if (enabled) void refresh();
    return () => { sequence.current += 1; };
  }, [enabled, refresh]));
  // Synchronous ownership check hides A's status on B's very first render.
  const visible = state.userId === userId ? state : { userId, status: 'loading' as const };
  return { ...visible, refresh };
}
