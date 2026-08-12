import { userRepository } from '../repositories/userRepository';
import { AuthError } from '../types/errors';
import { PublicUser, toPublicUser } from '../types/user';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface UpdateUserInput {
  name?: string;
  email?: string;
  photo?: string | null;
  role?: string;
  phone?: string;
}

/**
 * Edição de dados do usuário já autenticado (perfil). Separado do
 * `authService` porque não lida com senha/sessão — só com o registro do
 * usuário em si.
 */
export const userService = {
  async getById(userId: string): Promise<PublicUser | null> {
    if (isSupabaseConfigured) {
      let { data, error } = await supabase!.from('profiles').select('id, name, email, photo, role, phone, onboarding_completed, created_at').eq('id', userId).maybeSingle();
      if (error && /column .* does not exist|could not find the .* column .* schema cache/i.test(error.message)) {
        const fallbackResult = await supabase!.from('profiles').select('id, name, email, photo, onboarding_completed, created_at').eq('id', userId).maybeSingle();
        data = fallbackResult.data as typeof data;
        error = fallbackResult.error;
      }
      if (error) throw new Error(error.message);
      return data ? { id: data.id, name: data.name, email: data.email, photo: data.photo, role: data.role ?? '', phone: data.phone ?? '', onboardingCompleted: data.onboarding_completed, createdAt: data.created_at } : null;
    }
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
      if (!isSupabaseConfigured) {
        const existing = await userRepository.findByEmail(normalized);
        if (existing && existing.id !== userId) {
          throw new AuthError('EMAIL_ALREADY_REGISTERED');
        }
      }
      updates = { ...updates, email: normalized };
    }

    if (isSupabaseConfigured) {
      const { error: authError } = updates.email !== undefined
        ? await supabase!.auth.updateUser({ email: updates.email })
        : { error: null };
      if (authError) throw new Error(authError.message);
      const profileUpdates = {
        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
        ...(updates.email !== undefined ? { email: updates.email } : {}),
        ...(updates.photo !== undefined ? { photo: updates.photo } : {}),
        ...(updates.role !== undefined ? { role: updates.role.trim() } : {}),
        ...(updates.phone !== undefined ? { phone: updates.phone.trim() } : {}),
        updated_at: new Date().toISOString(),
      };
      let { data, error } = await supabase!.from('profiles').update(profileUpdates).eq('id', userId).select('id, name, email, photo, role, phone, onboarding_completed, created_at').single();
      if (error && /column .* does not exist|could not find the .* column .* schema cache/i.test(error.message)) {
        const fallbackUpdates = {
          ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
          ...(updates.email !== undefined ? { email: updates.email } : {}),
          ...(updates.photo !== undefined ? { photo: updates.photo } : {}),
          updated_at: new Date().toISOString(),
        };
        const fallbackResult = await supabase!.from('profiles').update(fallbackUpdates).eq('id', userId).select('id, name, email, photo, onboarding_completed, created_at').single();
        data = fallbackResult.data as typeof data;
        error = fallbackResult.error;
      }
      if (error) throw new Error(error.message);
      if (!data) throw new AuthError('USER_NOT_FOUND');
      return { id: data.id, name: data.name, email: data.email, photo: data.photo, role: data.role ?? '', phone: data.phone ?? '', onboardingCompleted: data.onboarding_completed, createdAt: data.created_at };
    }

    const updated = await userRepository.update(userId, {
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.email !== undefined ? { email: updates.email } : {}),
      ...(updates.photo !== undefined ? { photo: updates.photo } : {}),
      ...(updates.role !== undefined ? { role: updates.role.trim() } : {}),
      ...(updates.phone !== undefined ? { phone: updates.phone.trim() } : {}),
    });

    if (!updated) {
      throw new AuthError('USER_NOT_FOUND');
    }

    return toPublicUser(updated);
  },

  async markOnboardingCompleted(userId: string, completed = true): Promise<PublicUser> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase!.from('profiles').update({ onboarding_completed: completed, updated_at: new Date().toISOString() }).eq('id', userId).select('id, name, email, photo, onboarding_completed, created_at').single();
      if (error) throw new Error(error.message);
      return { id: data.id, name: data.name, email: data.email, photo: data.photo, onboardingCompleted: data.onboarding_completed, createdAt: data.created_at };
    }
    const updated = await userRepository.update(userId, { onboardingCompleted: completed });
    if (!updated) {
      throw new AuthError('USER_NOT_FOUND');
    }
    return toPublicUser(updated);
  },
};
