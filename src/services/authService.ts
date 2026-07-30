import { userRepository } from '../repositories/userRepository';
import { authRepository } from '../repositories/authRepository';
import { AuthError } from '../types/errors';
import { AuthResult, PublicUser, Session, User, toPublicUser } from '../types/user';
import { generateFakeToken, generateId } from '../utils/id';

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
    // Remove apenas a sessão ativa — os usuários cadastrados permanecem.
    await authRepository.clearSession();
  },

  /**
   * Chamado uma vez, ao abrir o app: verifica se existe uma sessão salva e,
   * se existir, recarrega o usuário correspondente.
   */
  async restoreSession(): Promise<AuthResult | null> {
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
