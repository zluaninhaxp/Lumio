import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import { businessStateService, businessSyncStatus } from '../services/businessStateService';
import { confirmAction } from '../services/confirmedAction';

/** Canonical presentation preference; read the old device key only for migration. */
export function useDismissedTaskSuggestions(userId: string | undefined) {
  const ids = useAppStore(state => state.dismissedTaskSuggestionIds);
  useEffect(() => {
    if (!userId || !businessStateService.isStarted(userId)) return;
    let active = true;
    const key = '@lumio/task-suggestions/dismissed/' + userId;
    void (async () => {
      const raw = await AsyncStorage.getItem(key);
      if (!raw || !active || !businessStateService.isStarted(userId)) return;
      const legacy: unknown = JSON.parse(raw);
      if (!Array.isArray(legacy) || !legacy.every(id => typeof id === 'string')) throw new Error('Preferência antiga inválida.');
      const current = useAppStore.getState().dismissedTaskSuggestionIds;
      useAppStore.setState({ dismissedTaskSuggestionIds: [...new Set([...current, ...legacy])] });
      await businessStateService.commit();
      await AsyncStorage.removeItem(key);
    })().catch(() => businessSyncStatus.reportWarning('Não foi possível migrar sugestões dispensadas. A cópia do aparelho foi preservada.'));
    return () => { active = false; };
  }, [userId]);
  const dismiss = useCallback((id: string) => {
    if (!userId) return;
    void confirmAction('dismiss-suggestion:' + id, () => { useAppStore.getState().dismissTaskSuggestion(id); return () => {}; });
  }, [userId]);
  return { dismissedIds: useMemo(() => new Set(ids), [ids]), dismiss, ready: !!userId && businessStateService.isStarted(userId) };
}
