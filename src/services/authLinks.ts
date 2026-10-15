import { supabase } from '../lib/supabase';
export const AUTH_REDIRECT = 'lumio://auth-callback';
export function parseAuthLink(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'lumio:' || !((url.hostname === 'auth-callback' && (!url.pathname || url.pathname === '/')) || (!url.hostname && url.pathname === '/auth-callback'))) throw new Error('Link de autenticação inválido.');
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error') ?? fragment.get('error');
  if (error) throw new Error('Link expirado ou inválido. Solicite um novo e-mail.');
  const recovery = url.searchParams.get('intent') === 'recovery' || fragment.get('type') === 'recovery';
  if (!code) throw new Error('Não foi possível validar este link. Solicite um novo e-mail no aplicativo.');
  return { code, recovery };
}
export async function exchangeAuthLink(raw: string) {
  if (!supabase) throw new Error('Autenticação indisponível.');
  const parsed = parseAuthLink(raw);
  const { data, error } = await supabase.auth.exchangeCodeForSession(parsed.code);
  if (error || !data.session) throw new Error('Link expirado ou aberto em outro aparelho. Solicite um novo e-mail neste aplicativo.');
  return parsed.recovery;
}
