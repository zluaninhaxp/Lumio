import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageError } from '../types/errors';

/**
 * Acesso transitório a dados legados para migração. Nenhum repository de
 * negócio usa esta camada como destino de novas gravações.
 */
export const storageService = {
  async getItem<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      throw new StorageError(`Falha ao ler a chave "${key}" do armazenamento local.`, error);
    }
  },

  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      throw new StorageError(`Falha ao salvar a chave "${key}" no armazenamento local.`, error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      throw new StorageError(`Falha ao remover a chave "${key}" do armazenamento local.`, error);
    }
  },
};
