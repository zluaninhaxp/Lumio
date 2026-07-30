import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageError } from '../types/errors';

/**
 * Camada mais baixa de persistência. É a ÚNICA parte do app que importa
 * o AsyncStorage diretamente — tudo o mais (repositories, services,
 * contexts, telas) fala apenas com `storageService`.
 *
 * Quando o backend real entrar, este arquivo pode até continuar existindo
 * (cache local), mas os `repositories` passarão a chamar uma API HTTP em
 * vez dele. A troca fica isolada aqui.
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
