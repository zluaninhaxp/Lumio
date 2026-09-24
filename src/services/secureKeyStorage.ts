import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AIProviderError } from '../ai/aiProvider';
import { supabase } from '../lib/supabase';

const LEGACY_KEY = '@lumio/ai-api-key';
const LEGACY_FALLBACK = '@lumio/ai-api-key-fallback';
const legacyOptions = { keychainService: 'lumio-ai', keychainAccessible: SecureStore.WHEN_UNLOCKED };

async function invoke(action: string, extra: Record<string, unknown> = {}): Promise<{ configured?: boolean }> {
  if (!supabase) throw new AIProviderError('provider', 'Serviço de IA não configurado.');
  const { data, error } = await supabase.functions.invoke('ai', { body: { action, ...extra } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 429) throw new AIProviderError('quota-exceeded', 'Limite de uso do Lumio atingido. Tente novamente mais tarde.');
    throw new AIProviderError('network');
  }
  return data as { configured?: boolean };
}

/** Server-owned BYOK credential. The full key is never returned to the app. */
export const secureKeyStorage = {
  async hasApiKey(): Promise<boolean> {
    const result = await invoke('status');
    return result.configured === true;
  },
  async getMaskedApiKey(): Promise<string | null> {
    return await this.hasApiKey() ? '•••• configurada' : null;
  },
  async setApiKey(rawKey: string): Promise<void> {
    const key = rawKey.trim();
    if (key.length < 20 || key.length > 256) throw new AIProviderError('invalid-input', 'Chave de IA inválida.');
    await invoke('set_key', { key });
    if (!await this.hasApiKey()) throw new AIProviderError('provider', 'Não foi possível confirmar a chave salva.');
    // The old obfuscated key cannot be safely migrated without bundling its
    // hardcoded XOR secret. Remove it only after a new remote key is confirmed.
    await AsyncStorage.removeItem(LEGACY_FALLBACK).catch(() => {});
    if (await SecureStore.isAvailableAsync()) await SecureStore.deleteItemAsync(LEGACY_KEY, legacyOptions).catch(() => {});
  },
  async removeApiKey(): Promise<void> {
    await invoke('delete_key');
    await AsyncStorage.removeItem(LEGACY_FALLBACK).catch(() => {});
    if (await SecureStore.isAvailableAsync()) await SecureStore.deleteItemAsync(LEGACY_KEY, legacyOptions).catch(() => {});
  },
  async isSupported(): Promise<boolean> { return !!supabase; },
};
