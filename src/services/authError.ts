import { AuthError } from '../types/errors';

type SupabaseAuthFailure = { message: string; code?: string; status?: number; name?: string };

export function throwAuthError(error: SupabaseAuthFailure): never {
  const { message, code, status, name } = error;
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered|already exists/i.test(message)) {
    throw new AuthError('EMAIL_ALREADY_REGISTERED');
  }
  if (code === 'invalid_credentials' || /invalid login credentials|invalid password/i.test(message)) {
    throw new AuthError('INVALID_PASSWORD');
  }
  if (code === 'email_not_confirmed') {
    throw new AuthError('EMAIL_CONFIRMATION_REQUIRED', 'Confirme seu e-mail antes de entrar.');
  }
  if (code === 'weak_password') throw new AuthError('WEAK_PASSWORD', 'Use uma senha mais forte, conforme os requisitos do cadastro.');
  if (code === 'email_address_invalid') throw new AuthError('INVALID_EMAIL');
  if (status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    throw new Error('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.');
  }
  if ((status ?? 0) >= 500) {
    throw new Error('O serviço de autenticação está indisponível. Tente novamente em alguns minutos.');
  }
  if (name === 'AuthRetryableFetchError' || /network request failed|failed to fetch|aborted|aborterror|timed?\s*out|timeout/i.test(message)) {
    throw new Error('Não foi possível conectar ao serviço de autenticação. Verifique a internet do celular e tente novamente. Se você estava criando uma conta, tente entrar com os mesmos dados antes de repetir o cadastro.');
  }
  if (code === 'signup_disabled' || code === 'email_provider_disabled') {
    throw new Error('O cadastro por e-mail está desabilitado. Entre em contato com o suporte.');
  }
  // Only safe diagnostic fields: never log credentials or the whole response.
  console.warn('[auth] Falha de autenticação', { code, status, name });
  throw new Error('Não foi possível autenticar. Tente novamente.');
}
