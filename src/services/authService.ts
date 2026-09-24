import { AuthError } from '../types/errors';
import type { AuthResult, PublicUser, Session } from '../types/user';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { photoService } from './photoService';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function client() {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase não configurado. Configure a URL e a chave pública do projeto.');
  return supabase;
}
function session(accessToken: string, userId: string): Session {
  return { userId, token: accessToken, loginAt: new Date().toISOString() };
}
async function profile(userId: string, fallback?: { name?: string; email?: string }): Promise<PublicUser> {
  const { data, error } = await client().from('profiles').select('id,name,email,photo,role,phone,onboarding_completed,created_at').eq('id', userId).maybeSingle();
  if (error) throw new Error('Não foi possível carregar seu perfil.');
  return {
    id: userId, name: data?.name ?? fallback?.name ?? '', email: data?.email ?? fallback?.email ?? '',
    photo: data?.photo ? await photoService.signedUrl() : null, role: data?.role ?? '', phone: data?.phone ?? '',
    onboardingCompleted: data?.onboarding_completed ?? false,
    createdAt: data?.created_at ?? new Date().toISOString(),
  };
}
function authError(message: string): never {
  if (/already registered|already exists/i.test(message)) throw new AuthError('EMAIL_ALREADY_REGISTERED');
  if (/invalid login credentials|invalid password/i.test(message)) throw new AuthError('INVALID_PASSWORD');
  throw new Error('Não foi possível autenticar. Tente novamente.');
}
export interface RegisterInput { name: string; email: string; password: string }
export interface LoginInput { email: string; password: string }

export const authService = {
  async changePassword(_userId: string, currentPassword: string, newPassword: string): Promise<void> {
    if (newPassword.length < 6) throw new AuthError('WEAK_PASSWORD');
    const api = client();
    const { data, error } = await api.auth.getUser();
    if (error || !data.user?.email || !currentPassword) throw new AuthError('INVALID_PASSWORD');
    const { error: reauthError } = await api.auth.signInWithPassword({ email: data.user.email, password: currentPassword });
    if (reauthError) throw new AuthError('INVALID_PASSWORD');
    const result = await api.auth.updateUser({ password: newPassword });
    if (result.error) throw new Error('Não foi possível alterar a senha.');
  },
  async deleteAccount(_userId: string, password: string): Promise<void> {
    if (!password) throw new AuthError('INVALID_PASSWORD');
    const { error } = await client().functions.invoke('delete-account', { body: { password } });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      if (status === 429) throw new Error('Muitas tentativas. Aguarde antes de tentar novamente.');
      if (status === 403) throw new AuthError('INVALID_PASSWORD');
      throw new Error('Não foi possível excluir a conta.');
    }
    await client().auth.signOut();
  },
  async register({ name, email, password }: RegisterInput): Promise<AuthResult> {
    if (!name.trim()) throw new AuthError('INVALID_NAME');
    if (!EMAIL_REGEX.test(email.trim())) throw new AuthError('INVALID_EMAIL');
    if (password.length < 6) throw new AuthError('WEAK_PASSWORD');
    const { data, error } = await client().auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { name: name.trim() } } });
    if (error) authError(error.message);
    if (!data.user) throw new Error('Não foi possível criar a conta.');
    if (!data.session) throw new AuthError('EMAIL_CONFIRMATION_REQUIRED');
    return { user: await profile(data.user.id, { name, email }), session: session(data.session.access_token, data.user.id) };
  },
  async login({ email, password }: LoginInput): Promise<AuthResult> {
    if (!EMAIL_REGEX.test(email.trim())) throw new AuthError('INVALID_EMAIL');
    const { data, error } = await client().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) authError(error.message);
    if (!data.user || !data.session) throw new Error('Sessão inválida.');
    return { user: await profile(data.user.id, { email }), session: session(data.session.access_token, data.user.id) };
  },
  async logout(): Promise<void> {
    const { error } = await client().auth.signOut();
    if (error) throw new Error('Não foi possível encerrar a sessão.');
  },
  async restoreSession(): Promise<AuthResult | null> {
    const api = client();
    const { data, error } = await api.auth.getUser();
    if (error || !data.user) return null;
    const { data: sessionData, error: sessionError } = await api.auth.getSession();
    if (sessionError || !sessionData.session) return null;
    return { user: await profile(data.user.id, { name: data.user.user_metadata?.name, email: data.user.email }), session: session(sessionData.session.access_token, data.user.id) };
  },
};
