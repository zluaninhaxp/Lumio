/**
 * Registro completo do usuário, exatamente como fica salvo no AsyncStorage
 * (inclui a senha). Nunca deve "vazar" para fora da camada de
 * repositories/services — telas e Context só devem enxergar `PublicUser`.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  /** Texto puro por enquanto — apenas para desenvolvimento local. */
  password: string;
  createdAt: string;
  photo?: string | null;
  role?: string;
  phone?: string;
  onboardingCompleted: boolean;
}

/** Versão segura do usuário, sem a senha, para uso em Contexts/telas. */
export type PublicUser = Omit<User, 'password'>;

export function toPublicUser(user: User): PublicUser {
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

/** Sessão fake, criada no login/cadastro e removida no logout. */
export interface Session {
  userId: string;
  token: string;
  loginAt: string;
}

export interface AuthResult {
  user: PublicUser;
  session: Session;
}
