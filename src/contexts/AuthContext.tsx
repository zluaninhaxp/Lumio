import { createContext, useCallback, useEffect, useMemo, useState, ReactNode } from 'react';
import { authService } from '../services/authService';
import { userService, UpdateUserInput } from '../services/userService';
import { PublicUser } from '../types/user';

export interface AuthContextValue {
  currentUser: PublicUser | null;
  isAuthenticated: boolean;
  /** true enquanto a sessão salva ainda está sendo verificada (abertura do app). */
  loading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: UpdateUserInput) => Promise<void>;
  /** Recarrega `currentUser` do storage — útil após alterações feitas via services diretamente. */
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    authService
      .restoreSession()
      .then((result) => {
        if (!isMounted) return;
        setCurrentUser(result?.user ?? null);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authService.login({ email, password });
    setCurrentUser(result.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const result = await authService.register({ name, email, password });
    setCurrentUser(result.user);
  }, []);

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
