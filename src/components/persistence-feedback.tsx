import { useEffect, useState, type ReactNode } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { businessStateService, businessSyncStatus } from '../services/businessStateService';
import { Colors, Spacing, Typography } from '../constants/theme';
import { AppAlert } from '../services/appAlert';

export function PersistenceFeedback({ children }: { children: ReactNode }) {
  const { ready, initializationError, retryInitialization, refreshUser, loading } = useAuth();
  const [sync, setSync] = useState(businessSyncStatus.get());
  const [busy, setBusy] = useState(false);
  useEffect(() => businessSyncStatus.subscribe(setSync), []);
  const retry = async (choice?: 'local' | 'remote') => {
    if (busy) return;
    setBusy(true);
    try {
      if (choice) await businessStateService.resolveConflict(choice);
      else if (initializationError || !businessStateService.isStarted()) await retryInitialization();
      else { await businessStateService.commit(); await refreshUser(); }
    } catch (error) {
      AppAlert.alert('Não foi possível sincronizar', error instanceof Error ? error.message : 'Tente novamente com internet.', undefined, { variant: 'warning' });
    } finally { setBusy(false); }
  };
  const button = (label: string, choice?: 'local' | 'remote') => <TouchableOpacity disabled={busy || loading} onPress={() => void retry(choice)} accessibilityRole="button" style={{ padding: Spacing.sm }}><Text style={{ color: Colors.accentText, fontFamily: Typography.semibold, textAlign: 'center' }}>{label}</Text></TouchableOpacity>;
  if (!ready && (initializationError || loading)) return <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.xl, backgroundColor: loading ? Colors.primary : Colors.bg }}>
    {loading ? <Image source={require('../../assets/lumio-splash.png')} resizeMode="contain" style={{ width: '78%', height: '40%', maxWidth: 420, maxHeight: 420, alignSelf: 'center' }} /> : <><Text style={{ color: Colors.ink, fontFamily: Typography.medium, textAlign: 'center' }}>{initializationError}</Text>{button('Tentar novamente')}</>}
  </View>;
  return <>
    {['error', 'conflict', 'warning', 'saving'].includes(sync.status) && <View accessibilityLiveRegion="polite" style={{ padding: Spacing.sm, backgroundColor: Colors.warningActionBackground }}>
      <Text style={{ color: Colors.ink, textAlign: 'center', fontFamily: Typography.regular }}>{sync.status === 'saving' ? 'Confirmando alterações…' : sync.error}</Text>
      {sync.status === 'error' && button('Tentar novamente')}
      {sync.status === 'conflict' && <View style={{ flexDirection: 'row', justifyContent: 'center' }}>{businessStateService.canKeepLocal() && button('Manter minha edição', 'local')}{button('Usar edição remota', 'remote')}<TouchableOpacity onPress={() => AppAlert.alert('Campos em conflito', businessStateService.conflictDetails(), undefined, { variant: 'warning' })} style={{ padding: Spacing.sm }}><Text style={{ color: Colors.accentText }}>Ver conflitos</Text></TouchableOpacity></View>}
    </View>}
    {children}
  </>;
}
