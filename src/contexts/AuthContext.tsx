import { createContext, useCallback, useEffect, useMemo, useState, ReactNode } from 'react';
import { AppState } from 'react-native';
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

  login: (email: string, password: string) => Promise<PublicUser>;
  register: (name: string, email: string, password: string) => Promise<PublicUser>;
  logout: () => Promise<void>;
  updateUser: (updates: UpdateUserInput) => Promise<void>;
  /** Recarrega `currentUser` do storage — útil após alterações feitas via services diretamente. */
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

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

  const hydrateOnboarding = useCallback(async (user: PublicUser) => {
    try {
      const record = await onboardingService.getResponses(user.id);
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
      const cleanedProfile = removeLegacyIntentMarkers(record.structuredProfile);
      if (cleanedProfile !== record.structuredProfile) {
        void onboardingService.saveStructuredProfile(user.id, cleanedProfile);
      }
      const learnedIntentMarkers = await learnedIntentRepository.getAll(user.id);
      useAppStore.getState().hydrateLearnedIntentMarkers(learnedIntentMarkers);
    } catch {
      throw new Error('Não foi possível carregar as configurações da conta. Tente novamente.');
    }
  }, []);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void businessStateService.commit().catch(() => {});
    });
    let isMounted = true;

    authService
      .restoreSession()
      .then(async (result) => {
        if (!isMounted) return;
        if (result?.user) {
          businessStateService.clearPrivateState();
          let migrationWarning = false;
          try { await legacyMigrationService.migrate(result.user.id, result.user.email); }
          catch { migrationWarning = true; }
          await hydrateOnboarding(result.user);
          await businessStateService.start(result.user.id);
          if (migrationWarning) businessSyncStatus.reportWarning('Dados antigos foram preservados no aparelho e precisam de migração manual.');
          if (isMounted) setCurrentUser(result.user);
        }
      })
      .catch(() => {
        businessStateService.stop();
        businessStateService.clearPrivateState();
        if (isMounted) setCurrentUser(null);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      appStateSubscription.remove();
    };
  }, [hydrateOnboarding]);

  const login = useCallback(async (email: string, password: string): Promise<PublicUser> => {
    setLoading(true);
    businessStateService.stop();
    businessStateService.clearPrivateState();
    try {
      const result = await authService.login({ email, password });
      let migrationWarning = false;
      try { await legacyMigrationService.migrate(result.user.id, result.user.email, password); }
      catch { migrationWarning = true; }
      await hydrateOnboarding(result.user);
      await businessStateService.start(result.user.id);
      if (migrationWarning) businessSyncStatus.reportWarning('Dados antigos foram preservados no aparelho e precisam de migração manual.');
      setCurrentUser(result.user);
      return result.user;
    } finally { setLoading(false); }
  }, [hydrateOnboarding]);

  const register = useCallback(async (name: string, email: string, password: string): Promise<PublicUser> => {
    setLoading(true);
    businessStateService.stop();
    businessStateService.clearPrivateState();
    try {
      const result = await authService.register({ name, email, password });
      let migrationWarning = false;
      try { await legacyMigrationService.migrate(result.user.id, result.user.email, password); }
      catch { migrationWarning = true; }
      await hydrateOnboarding(result.user);
      await businessStateService.start(result.user.id);
      if (migrationWarning) businessSyncStatus.reportWarning('Dados antigos foram preservados no aparelho e precisam de migração manual.');
      setCurrentUser(result.user);
      return result.user;
    } finally { setLoading(false); }
  }, [hydrateOnboarding]);

  const logout = useCallback(async () => {
    await businessStateService.commit();
    try { await authService.logout(); }
    finally {
      businessStateService.stop();
      businessStateService.clearPrivateState();
      setCurrentUser(null);
    }
  }, []);

  const updateUser = useCallback(
    async (updates: UpdateUserInput) => {
      if (!currentUser) return;
      const updated = await userService.updateUser(currentUser.id, updates);
      setCurrentUser(updated);
    },
    [currentUser]
  );

  const refreshUser = useCallback(async () => {
    if (!currentUser) return;
    const fresh = await userService.getById(currentUser.id);
    setCurrentUser(fresh);
  }, [currentUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      isAuthenticated: !!currentUser,
      loading,
      login,
      register,
      logout,
      updateUser,
      refreshUser,
    }),
    [currentUser, loading, login, register, logout, updateUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
