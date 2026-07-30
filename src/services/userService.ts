import { userRepository } from '../repositories/userRepository';
import { AuthError } from '../types/errors';
import { PublicUser, toPublicUser } from '../types/user';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface UpdateUserInput {
  name?: string;
  email?: string;
  photo?: string | null;
}

/**
 * Edição de dados do usuário já autenticado (perfil). Separado do
 * `authService` porque não lida com senha/sessão — só com o registro do
 * usuário em si.
 */
export const userService = {
  async getById(userId: string): Promise<PublicUser | null> {
    const user = await userRepository.findById(userId);
    return user ? toPublicUser(user) : null;
  },

  async updateUser(userId: string, updates: UpdateUserInput): Promise<PublicUser> {
    if (updates.name !== undefined && !updates.name.trim()) {
      throw new AuthError('INVALID_NAME');
    }

    if (updates.email !== undefined) {
      const normalized = updates.email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalized)) {
        throw new AuthError('INVALID_EMAIL');
      }
      const existing = await userRepository.findByEmail(normalized);
      if (existing && existing.id !== userId) {
        throw new AuthError('EMAIL_ALREADY_REGISTERED');
      }
      updates = { ...updates, email: normalized };
    }

    const updated = await userRepository.update(userId, {
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.email !== undefined ? { email: updates.email } : {}),
      ...(updates.photo !== undefined ? { photo: updates.photo } : {}),
    });

    if (!updated) {
      throw new AuthError('USER_NOT_FOUND');
    }

    return toPublicUser(updated);
  },

  async markOnboardingCompleted(userId: string, completed = true): Promise<PublicUser> {
    const updated = await userRepository.update(userId, { onboardingCompleted: completed });
    if (!updated) {
      throw new AuthError('USER_NOT_FOUND');
    }
    return toPublicUser(updated);
  },
};
