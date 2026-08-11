import { userRepository } from '../repositories/userRepository';
import { authRepository } from '../repositories/authRepository';
import { AuthError } from '../types/errors';
import { AuthResult, PublicUser, Session, User, toPublicUser } from '../types/user';
import { generateFakeToken, generateId } from '../utils/id';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

function assertValidName(name: string) {
  if (!name || !name.trim()) {
    throw new AuthError('INVALID_NAME');
  }
}

function assertValidEmail(email: string) {
  if (!email || !EMAIL_REGEX.test(email.trim())) {
    throw new AuthError('INVALID_EMAIL');
  }
}

function assertValidPassword(password: string) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError('WEAK_PASSWORD');
  }
}

async function createSessionForUser(userId: string): Promise<Session> {
  const session: Session = {
    userId,
    token: generateFakeToken(),
    loginAt: new Date().toISOString(),
  };
  await authRepository.saveSession(session);
  return session;
}

async function getRemoteProfile(userId: string, fallback?: { name?: string; email?: string }): Promise<PublicUser> {
  const { data, error } = await supabase!.from('profiles').select('id, name, email, photo, onboarding_completed').eq('id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return {
    id: userId,
    name: data?.name ?? fallback?.name ?? '',
    email: data?.email ?? fallback?.email ?? '',
    photo: data?.photo ?? null,
    onboardingCompleted: data?.onboarding_completed ?? false,
    createdAt: new Date().toISOString(),
  };
}

function remoteSession(accessToken: string, userId: string): Session {
  return { userId, token: accessToken, loginAt: new Date().toISOString() };
}

function throwRemoteAuthError(message: string): never {
  if (/already registered|already exists/i.test(message)) throw new AuthError('EMAIL_ALREADY_REGISTERED');
  if (/invalid login credentials|invalid password/i.test(message)) throw new AuthError('INVALID_PASSWORD');
  throw new Error(message);
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Regras de autenticação. Não sabe nada sobre AsyncStorage — fala apenas
 * com `userRepository`/`authRepository`. Quando o backend real (Django)
 * chegar, só esses dois repositories mudam de implementação; este service,
 * o `AuthContext`, o `useAuth` e as telas continuam iguais.
 */
export const authService = {
  async register({ name, email, password }: RegisterInput): Promise<AuthResult> {
    assertValidName(name);
    assertValidEmail(email);
    assertValidPassword(password);

    if (isSupabaseConfigured) {
      const { data, error } = await supabase!.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { name: name.trim() } },
      });
      if (error) throwRemoteAuthError(error.message);
      if (!data.user) throw new Error('O Supabase não retornou o usuário criado.');
      if (!data.session) throw new AuthError('EMAIL_CONFIRMATION_REQUIRED');
      const user = await getRemoteProfile(data.user.id, { name, email });
      return { user, session: remoteSession(data.session.access_token, data.user.id) };
    }

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AuthError('EMAIL_ALREADY_REGISTERED');
    }

    const user: User = {
      id: generateId('user_'),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      createdAt: new Date().toISOString(),
      photo: null,
      onboardingCompleted: false,
    };

    await userRepository.create(user);
    const session = await createSessionForUser(user.id);

    return { user: toPublicUser(user), session };
  },

  async login({ email, password }: LoginInput): Promise<AuthResult> {
    assertValidEmail(email);

    if (isSupabaseConfigured) {
      const { data, error } = await supabase!.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throwRemoteAuthError(error.message);
      if (!data.user || !data.session) throw new Error('Sessão inválida retornada pelo Supabase.');
      const user = await getRemoteProfile(data.user.id, { email });
      return { user, session: remoteSession(data.session.access_token, data.user.id) };
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new AuthError('USER_NOT_FOUND');
    }
    if (user.password !== password) {
      throw new AuthError('INVALID_PASSWORD');
    }

    const session = await createSessionForUser(user.id);
    return { user: toPublicUser(user), session };
  },

  async logout(): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase!.auth.signOut();
      if (error) throw new Error(error.message);
      return;
    }
    // Remove apenas a sessão ativa — os usuários cadastrados permanecem.
    await authRepository.clearSession();
  },

  /**
   * Chamado uma vez, ao abrir o app: verifica se existe uma sessão salva e,
   * se existir, recarrega o usuário correspondente.
   */
  async restoreSession(): Promise<AuthResult | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase!.auth.getSession();
      if (error) throw new Error(error.message);
      if (!data.session) return null;
      const user = await getRemoteProfile(data.session.user.id, { name: data.session.user.user_metadata?.name, email: data.session.user.email });
      return { user, session: remoteSession(data.session.access_token, data.session.user.id) };
    }

    const session = await authRepository.getSession();
    if (!session) return null;

    const user = await userRepository.findById(session.userId);
    if (!user) {
      // Sessão órfã (usuário removido) — limpa e trata como deslogado.
      await authRepository.clearSession();
      return null;
    }

    return { user: toPublicUser(user), session };
  },
};
