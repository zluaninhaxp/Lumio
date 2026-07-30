import { storageService } from '../services/storageService';
import { StorageKeys } from '../constants/storageKeys';
import { Session } from '../types/user';

/**
 * Acesso cru à sessão ativa. Separado do `userRepository` de propósito:
 * "logout" deve remover apenas a sessão, nunca os usuários cadastrados.
 */
export const authRepository = {
  async getSession(): Promise<Session | null> {
    return storageService.getItem<Session>(StorageKeys.SESSION);
  },

  async saveSession(session: Session): Promise<void> {
    await storageService.setItem(StorageKeys.SESSION, session);
  },

  async clearSession(): Promise<void> {
    await storageService.removeItem(StorageKeys.SESSION);
  },
};
