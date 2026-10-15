import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../hooks/useAuth';
import { businessStateService, businessSyncStatus } from '../services/businessStateService';

/** Persistence status stays internal; recovery never adds banners, alerts or screens. */
export function PersistenceFeedback({ children }: { children: ReactNode }) {
  const { ready, initializationError, retryInitialization } = useAuth();
  const [sync, setSync] = useState(businessSyncStatus.get());
  const [splashReleased, setSplashReleased] = useState(false);
  const retryDelay = useRef(5_000);
  const pathname = usePathname();
  useEffect(() => businessSyncStatus.subscribe(setSync), []);
  useEffect(() => {
    if (sync.status === 'ready') retryDelay.current = 5_000;
    // Conflicts remain preserved internally; never select a destructive winner.
    if (!initializationError && sync.status !== 'error') return;
    const timer = setTimeout(() => {
      retryDelay.current = Math.min(retryDelay.current * 2, 60_000);
      const recovery = initializationError || !ready
        ? retryInitialization()
        : businessStateService.commit();
      void recovery.catch(() => {});
    }, retryDelay.current);
    return () => clearTimeout(timer);
  }, [initializationError, ready, retryInitialization, sync]);
  useEffect(() => {
    if (splashReleased || !ready || pathname === '/') return;
    const frame = requestAnimationFrame(() => {
      void SplashScreen.hideAsync().catch(() => {});
      setSplashReleased(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, ready, splashReleased]);
  return <>{children}</>;
}
