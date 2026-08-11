export type AuthErrorCode =
  | 'INVALID_NAME'
  | 'INVALID_EMAIL'
  | 'WEAK_PASSWORD'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'EMAIL_CONFIRMATION_REQUIRED'
  | 'USER_NOT_FOUND'
  | 'INVALID_PASSWORD'
  | 'STORAGE_READ_ERROR'
  | 'STORAGE_WRITE_ERROR';

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  INVALID_NAME: 'Informe seu nome.',
  INVALID_EMAIL: 'Informe um e-mail válido.',
  WEAK_PASSWORD: 'A senha deve ter pelo menos 6 caracteres.',
  EMAIL_ALREADY_REGISTERED: 'Este e-mail já está cadastrado.',
  EMAIL_CONFIRMATION_REQUIRED: 'Conta criada. Confirme seu e-mail antes de entrar.',
  USER_NOT_FOUND: 'Não encontramos uma conta com esse e-mail.',
  INVALID_PASSWORD: 'Senha incorreta.',
  STORAGE_READ_ERROR: 'Não foi possível carregar os dados salvos.',
  STORAGE_WRITE_ERROR: 'Não foi possível salvar os dados.',
};

/**
 * Erro "de domínio" da camada de autenticação/persistência. As telas podem
 * confiar em `error.message` (já traduzido) ou usar `error.code` para
 * lógica condicional (ex.: destacar o campo de e-mail quando o código for
 * EMAIL_ALREADY_REGISTERED).
 */
export class AuthError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? AUTH_ERROR_MESSAGES[code]);
    this.name = 'AuthError';
    this.code = code;
  }
}

/** Erro genérico de leitura/escrita do AsyncStorage (camada de storageService). */
export class StorageError extends Error {
  cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}
