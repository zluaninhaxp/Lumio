import { createContext, useCallback, useEffect, useMemo, useState, ReactNode } from 'react';
import { authService } from '../services/authService';
import { userService, UpdateUserInput } from '../services/userService';
import { PublicUser } from '../types/user';
import { onboardingService } from '../services/onboardingService';
import { learnedIntentRepository } from '../repositories/learnedIntentRepository';
import { useAppStore } from '../store';
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
      });
      const cleanedProfile = removeLegacyIntentMarkers(record.structuredProfile);
      if (cleanedProfile !== record.structuredProfile) {
        void onboardingService.saveStructuredProfile(user.id, cleanedProfile);
      }
      const learnedIntentMarkers = await learnedIntentRepository.getAll(user.id);
      useAppStore.getState().hydrateLearnedIntentMarkers(learnedIntentMarkers);
    } catch (error) {
      console.warn('Falha ao carregar dados do onboarding:', error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    authService
      .restoreSession()
      .then(async (result) => {
        if (!isMounted) return;
        setCurrentUser(result?.user ?? null);
        if (result?.user) await hydrateOnboarding(result.user);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [hydrateOnboarding]);

  const login = useCallback(async (email: string, password: string): Promise<PublicUser> => {
    const result = await authService.login({ email, password });
    setCurrentUser(result.user);
    await hydrateOnboarding(result.user);
    return result.user;
  }, [hydrateOnboarding]);

  const register = useCallback(async (name: string, email: string, password: string): Promise<PublicUser> => {
    const result = await authService.register({ name, email, password });
    setCurrentUser(result.user);
    await hydrateOnboarding(result.user);
    return result.user;
  }, [hydrateOnboarding]);

  const logout = useCallback(async () => {
    await authService.logout();
    setCurrentUser(null);
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
