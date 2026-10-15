import { PersistenceError } from '../services/persistenceErrors';
import { chatHistoryService } from '../services/chatHistoryService';
import { supabase } from '../lib/supabase';
import { createContext, useCallback, useEffect, useMemo, useState, useRef, ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { clearLegacyAiKey } from '../services/legacy-ai-key-cleanup';
import { authService } from '../services/authService';
import { userService, UpdateUserInput } from '../services/userService';
import { PublicUser } from '../types/user';
import { onboardingService } from '../services/onboardingService';
import { learnedIntentRepository } from '../repositories/learnedIntentRepository';
import { useAppStore } from '../store';
import { businessStateService, businessSyncStatus } from '../services/businessStateService';
import { legacyMigrationService } from '../services/legacyMigrationService';
import type { OnboardingContextDTO } from '../ai/onboardingContext';
import type { OnboardingExtractionResult } from '../ai/types';

export interface AuthContextValue {
  currentUser: PublicUser | null;
  isAuthenticated: boolean;
  /** true enquanto a sessão salva ainda está sendo verificada (abertura do app). */
  loading: boolean;
  ready: boolean;
  initializationError: string | null;
  retryInitialization: () => Promise<void>;

  login: (email: string, password: string) => Promise<PublicUser>;
  register: (name: string, email: string, password: string) => Promise<PublicUser>;
  logout: (discardUnsyncedChanges?: boolean) => Promise<void>;
  updateUser: (updates: UpdateUserInput) => Promise<void>;
  /** Recarrega `currentUser` do storage — útil após alterações feitas via services diretamente. */
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export class UnsyncedChangesError extends Error {
  constructor() {
    super('Não foi possível sincronizar as últimas alterações antes de sair.');
    this.name = 'UnsyncedChangesError';
  }
}

function removeLegacyIntentMarkers(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const profile = value as Record<string, unknown>;
  const taxonomy = profile.taxonomy;
  if (!('learnedIntentMarkers' in profile) && (!taxonomy || typeof taxonomy !== 'object' || !('learnedIntentMarkers' in taxonomy))) return value;
  const { learnedIntentMarkers: _topLevel, ...withoutTopLevel } = profile;
  if (!taxonomy || typeof taxonomy !== 'object') return withoutTopLevel;
  const { learnedIntentMarkers: _nested, ...withoutNested } = taxonomy as Record<string, unknown>;
  return { ...withoutTopLevel, taxonomy: withoutNested };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const recovering = useRef(false);
  const transitioning = useRef(false);
  const accountGeneration = useRef(0);
  const userRef = useRef<PublicUser | null>(null);
  userRef.current = currentUser;

  const hydrateOnboarding = useCallback(async (user: PublicUser, expectedGeneration = accountGeneration.current) => {
    try {
      const record = await onboardingService.getResponses(user.id);
      const learnedIntentMarkers = record ? await learnedIntentRepository.getAll(user.id) : [];
      if (expectedGeneration !== accountGeneration.current) throw new Error('A conta foi alterada.');
      if (!record) {
        // Sem record persistido para este usuário: zera campos derivados
        // do onboarding no store para evitar herdar configurações de um
        // usuário anteriormente logado (o store é module-level e mantém
        // state entre logins). Não afeta dadosStrictmente demo (transações
        // /tarefas), mas elimina o bleed de categorias/tags/tipos gerados
        // pelo onboarding.
        useAppStore.getState().resetOnboardingState();
        useAppStore.getState().hydrateLearnedIntentMarkers([]);
        return;
      }
      useAppStore.getState().hydrateOnboarding({
        responses: (record.responses ?? {}) as Record<string, string>,
        context: (record.context ?? null) as OnboardingContextDTO | null,
        structuredProfile: removeLegacyIntentMarkers(record.structuredProfile) as OnboardingExtractionResult | null,
        activatedPlugins: record.activatedPlugins ?? [],
        pluginOrder: record.pluginOrder ?? [],
      });
      useAppStore.setState({ onboardingCompleted: user.onboardingCompleted });
      const cleanedProfile = removeLegacyIntentMarkers(record.structuredProfile);
      if (cleanedProfile !== record.structuredProfile) {
        void onboardingService.saveStructuredProfile(user.id, cleanedProfile).catch(() => businessSyncStatus.reportWarning('Não foi possível atualizar configurações antigas. Tente novamente.'));
      }
      useAppStore.getState().hydrateLearnedIntentMarkers(learnedIntentMarkers);
    } catch {
      throw new Error('Não foi possível carregar as configurações da conta. Tente novamente.');
    }
  }, []);

  const retryInitialization = useCallback(async () => {
    if (recovering.current || transitioning.current) return;
    recovering.current = true;
    const attempt = accountGeneration.current;
    if (!userRef.current) setLoading(true);
    setInitializationError(null);
    try {
      await clearLegacyAiKey();
      const result = await authService.restoreSession();
      if (attempt !== accountGeneration.current) return;
      if (!result) {
        businessStateService.stop(); businessStateService.clearPrivateState();
        setCurrentUser(null); setReady(true);
        return;
      }
      if (!businessStateService.isStarted(result.user.id)) {
        businessStateService.stop(); businessStateService.clearPrivateState();
        let migrationWarning = false;
        try { await legacyMigrationService.migrate(result.user.id, result.user.email); }
        catch { migrationWarning = true; }
        await hydrateOnboarding(result.user, attempt);
        if (attempt !== accountGeneration.current) return;
        await businessStateService.start(result.user.id);
          await chatHistoryService.start(result.user.id);
        if (attempt !== accountGeneration.current) throw new Error('A conta foi alterada.');
        if (chatHistoryService.hasPending()) businessSyncStatus.reportError('Há mensagens não confirmadas recuperadas. Toque em Tentar novamente para confirmar com internet.');
        else if (migrationWarning) businessSyncStatus.reportWarning('Dados antigos foram preservados no aparelho e precisam de migração manual.');
      } else { await chatHistoryService.start(result.user.id); await businessStateService.refresh(); }
      if (attempt === accountGeneration.current) {
        const fresh = await userService.getById(result.user.id);
        if (!fresh) throw new Error('Perfil indisponível. Tente novamente.');
        if (attempt === accountGeneration.current) { setCurrentUser(fresh); setReady(true); }
      }
    } catch (error) {
      if (attempt === accountGeneration.current) {
        const message = error instanceof Error ? error.message : 'Não foi possível carregar a conta. Tente novamente com internet.';
        setInitializationError(message); businessSyncStatus.reportError(message);
      }
    } finally {
      recovering.current = false;
      if (attempt === accountGeneration.current) setLoading(false);
    }
  }, [hydrateOnboarding]);

  useEffect(() => {
    void retryInitialization();
    if (Platform.OS !== 'web' && AppState.currentState === 'active') supabase?.auth.startAutoRefresh();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (Platform.OS !== 'web') supabase?.auth.startAutoRefresh();
        void retryInitialization();
      } else {
        if (Platform.OS !== 'web') supabase?.auth.stopAutoRefresh();
        if (businessStateService.isStarted()) void businessStateService.commit().catch(() => {});
      }
    });
    const { data: authListener } = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        accountGeneration.current++;
        businessStateService.stop(); businessStateService.clearPrivateState();
        setCurrentUser(null); setReady(true); setInitializationError(null); setLoading(false);
      }
      if (event === 'USER_UPDATED') setTimeout(() => { void retryInitialization(); }, 0);
    }) ?? { data: undefined };
    const refreshTimer = setInterval(() => {
      if (AppState.currentState === 'active' && userRef.current && !businessStateService.hasUnsavedChanges()) void retryInitialization();
    }, 60_000);
    return () => {
      accountGeneration.current++;
      appStateSubscription.remove(); authListener?.subscription.unsubscribe(); clearInterval(refreshTimer);
      if (Platform.OS !== 'web') supabase?.auth.stopAutoRefresh();
    };
  }, [retryInitialization]);

  const establishAccount = useCallback(async (authenticate: () => Promise<import('../types/user').AuthResult>, password?: string): Promise<PublicUser> => {
    if (transitioning.current) throw new Error('Aguarde a autenticação em andamento.');
    transitioning.current = true;
    const attempt = ++accountGeneration.current;
    let authenticated = false;
    setInitializationError(null); setReady(false); setLoading(true);
    businessStateService.stop(); businessStateService.clearPrivateState(); setCurrentUser(null);
    try {
      await clearLegacyAiKey();
      const result = await authenticate();
      authenticated = true;
      if (attempt !== accountGeneration.current) throw new Error('A conta foi alterada.');
      let migrationWarning = false;
      try { await legacyMigrationService.migrate(result.user.id, result.user.email, password); }
      catch { migrationWarning = true; }
      await hydrateOnboarding(result.user, attempt);
      if (attempt !== accountGeneration.current) throw new Error('A conta foi alterada.');
      await businessStateService.start(result.user.id);
      if (attempt !== accountGeneration.current) throw new Error('A conta foi alterada.');
      await chatHistoryService.start(result.user.id);
      if (attempt !== accountGeneration.current) throw new Error('A conta foi alterada.');
      if (chatHistoryService.hasPending()) businessSyncStatus.reportError('Há mensagens não confirmadas recuperadas. Toque em Tentar novamente para confirmar com internet.');
      else if (migrationWarning) businessSyncStatus.reportWarning('Dados antigos foram preservados no aparelho e precisam de migração manual.');
      setCurrentUser(result.user); setReady(true);
      return result.user;
    } catch (error) {
      if (attempt === accountGeneration.current) {
        if (authenticated || error instanceof PersistenceError) setInitializationError(error instanceof Error ? error.message : 'Falha ao carregar a conta. Tente novamente.');
        else setReady(true);
      }
      if (authenticated) throw new PersistenceError('Account hydration failed', 'ACCOUNT_LOAD');
      throw error;
    } finally {
      transitioning.current = false;
      if (attempt === accountGeneration.current) setLoading(false);
    }
  }, [hydrateOnboarding]);
  const login = useCallback((email: string, password: string) => establishAccount(() => authService.login({ email, password }), password), [establishAccount]);
  const register = useCallback((name: string, email: string, password: string) => establishAccount(() => authService.register({ name, email, password }), password), [establishAccount]);

  const logout = useCallback(async (discardUnsyncedChanges = false) => {
    accountGeneration.current++;
    if (discardUnsyncedChanges) {
      businessStateService.stop();
    } else {
      try { await businessStateService.commit(); }
      catch { throw new UnsyncedChangesError(); }
    }
    await authService.logout();
    {
      businessStateService.stop();
      businessStateService.clearPrivateState();
      setCurrentUser(null);
      await clearLegacyAiKey();
    }
  }, []);

  const updateUser = useCallback(
    async (updates: UpdateUserInput) => {
      if (!currentUser) return;
      const generation = accountGeneration.current;
      const updated = await userService.updateUser(currentUser.id, updates);
      if (generation === accountGeneration.current) setCurrentUser(updated);
    },
    [currentUser]
  );

  const refreshUser = useCallback(async () => {
    if (!currentUser) return;
    const generation = accountGeneration.current;
    const fresh = await userService.getById(currentUser.id);
    if (!fresh) throw new Error('Perfil indisponível. Tente novamente.');
    if (generation === accountGeneration.current) setCurrentUser(fresh);
  }, [currentUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      isAuthenticated: !!currentUser,
      loading,
      ready, initializationError, retryInitialization,
      login,
      register,
      logout,
      updateUser,
      refreshUser,
    }),
    [currentUser, loading, ready, initializationError, retryInitialization, login, register, logout, updateUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
