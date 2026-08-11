import * as SecureStore from 'expo-secure-store';
import { AIProviderError } from '../ai/aiProvider';

/**
 * Camada ÚNICA de acesso à chave de API do usuário (provedor de IA).
 *
 * POR QUE `expo-secure-store` e não `AsyncStorage`: a chave é um segredo do
 * usuário e precisa ir para o Keychain (iOS) / Keystore (Android) — nunca
 * para o AsyncStorage em texto plano, nunca para o estado do Zustand
 * persistido, nunca para o bundle do app. Este módulo é o único lugar que
 * sabe disso; o resto do app pede a chave por aqui.
 *
 * Esta camada é também o único lugar que sabe o nome da chave — qualquer
 * mudança de nome/keychainService fica isolada aqui.
 *
 * NUNCA logue o valor retornado por `getApiKey()` — ele é um segredo.
 *
 * AMBIENTES SEM SECURE STORE (Expo Go web, etc.): `expo-secure-store`
 *resolve `isAvailableAsync()` como `false` nesses ambientes, e qualquer
 * chamada lançaria. Aqui tratamos isso como "chave ausente" (`null` /
 * `false`) em vez de virar exceção de UI — o fluxo do onboarding segue
 * pelo caminho de simulação, e a tela de configurações mostra um aviso
 * claro (ver `ai-settings.tsx`). NUNCA deixamos a ausência de hardware
 * seguro quebrar a UX do onboarding, porque IA é opcional.
 */
const API_KEY_STORAGE_KEY = '@lumio/ai-api-key';
const KEYCHAIN_SERVICE = 'lumio-ai';

type WriteableSecureStoreOptions = NonNullable<
  Parameters<typeof SecureStore.setItemAsync>[2]
>;

const options: WriteableSecureStoreOptions = {
  keychainService: KEYCHAIN_SERVICE,
  // iOS: só acessível com dispositivo desbloqueado. Em Android o
  // keychainService vira o alias do keystore. Não exigimos biometria para
  // não atrapalhar o fluxo de onboarding.
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

/**
 * Cache em memória de "secure storage disponível neste ambiente" —
 * `isAvailableAsync()` é uma chamada nativa, evitamos repeti-la a cada
 * operação. Resolvido na primeira chamada; `null` = ainda não checado.
 */
let availabilityCache: boolean | null = null;

async function isSecureStoreAvailable(): Promise<boolean> {
  if (availabilityCache !== null) return availabilityCache;
  try {
    availabilityCache = await SecureStore.isAvailableAsync();
  } catch {
    availabilityCache = false;
  }
  return availabilityCache;
}

export const secureKeyStorage = {
  /**
   * Devolve a chave bruta do usuário, ou `null` se:
   *  - SecureStorage não está disponível neste ambiente (web/Expo Go web) —
   *    tratado como "sem chave", NÃO como erro;
   *  - não há chave cadastrada (caso normal).
   * Só rejeita em falha real de hardware seguro (raro) — e mesmo assim com
   * `AIProviderError` tipado, nunca string solta.
   */
  async getApiKey(): Promise<string | null> {
    if (!(await isSecureStoreAvailable())) return null;
    try {
      return await SecureStore.getItemAsync(API_KEY_STORAGE_KEY, options);
    } catch (error) {
      throw new AIProviderError(
        'provider',
        'Não foi possível acessar sua chave de IA salva no dispositivo.',
        error,
      );
    }
  },

  /**
   * Salva (ou sobrescreve) a chave. Rejeita como `AIProviderError` em falha
   * de escrita OU quando o ambiente não suporta secure storage (web) —
   * neste caso a mensagem deixa claro que não é suportado, não que a chave
   * está inválida. Faz trim e rejeita string vazia antes de tentar salvar.
   */
  async setApiKey(rawKey: string): Promise<void> {
    const key = rawKey.trim();
    if (!key) {
      throw new AIProviderError('invalid-input', 'A chave não pode ser vazia.');
    }
    if (!(await isSecureStoreAvailable())) {
      throw new AIProviderError(
        'provider',
        'Este aparelho não oferece armazenamento seguro para a chave de IA ' +
          '(comum em web e em alguns emuladores). Tente no app instalado em ' +
          'um celular real.',
      );
    }
    try {
      await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, key, options);
    } catch (error) {
      throw new AIProviderError(
        'provider',
        'Não foi possível salvar sua chave de IA no dispositivo.',
        error,
      );
    }
  },

  /** Remove a chave (idempotente — não falha se não havia chave). */
  async removeApiKey(): Promise<void> {
    if (!(await isSecureStoreAvailable())) return;
    try {
      await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY, options);
    } catch (error) {
      if (await this.hasApiKey()) {
        throw new AIProviderError(
          'provider',
          'Não foi possível remover sua chave de IA do dispositivo.',
          error,
        );
      }
    }
  },

  /**
   * `true` se existe uma chave salva (não lê o valor — só checa existência).
   * Em ambientes sem secure storage devolve `false` (não lança).
   */
  async hasApiKey(): Promise<boolean> {
    if (!(await isSecureStoreAvailable())) return false;
    try {
      const value = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY, options);
      return value != null && value.length > 0;
    } catch {
      return false;
    }
  },

  /**
   * Versão mascarada para exibição segura em UI: mostra só os últimos 4
   * caracteres, precedidos por reticências. Ex.: `...ab12`. Devolve
   * `null` se não houver chave — a UI decide o que mostrar nesse caso.
   * NUNCA devolva a chave completa por este (ou qualquer outro) método.
   * Em ambientes sem secure storage devolve `null` (não lança).
   */
  async getMaskedApiKey(): Promise<string | null> {
    const key = await this.getApiKey();
    if (!key) return null;
    if (key.length <= 4) return '••••';
    return `...${key.slice(-4)}`;
  },

  /**
   * `true` quando o aparelho dispõe de armazenamento seguro. Usado pela
   * tela de configurações para avisar o usuário (em vez de descobrir só
   * ao colar uma chave).
   */
  async isSupported(): Promise<boolean> {
    return isSecureStoreAvailable();
  },
};