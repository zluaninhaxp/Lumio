/**
 * Formato legado lido somente durante migração de contas locais antigas.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  /** Senha legada em texto puro, removida após migração confirmada. */
  password: string;
  createdAt: string;
  photo?: string | null;
  role?: string;
  phone?: string;
  onboardingCompleted: boolean;
}

/** Versão segura do usuário, sem a senha, para uso em Contexts/telas. */
export type PublicUser = Omit<User, 'password'>;

/** Visão da sessão administrada pelo Supabase Auth. */
export interface Session {
  userId: string;
  token: string;
  loginAt: string;
}

export interface AuthResult {
  user: PublicUser;
  session: Session;
}
