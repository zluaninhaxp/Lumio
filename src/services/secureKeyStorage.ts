import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AIProviderError } from '../ai/aiProvider';
import { sha256 } from '../utils/sha256';

/**
 * Camada ÚNICA de acesso à chave de API do usuário (provedor de IA).
 *
 * ESTRATÉGIA HÍBRIDA (segura o máximo possível SEM depender de hardware
 * que pode faltar em aparelhos sem lock screen / ROMs que reportam
 * Keychain indisponível):
 *
 *  1. Tenta `expo-secure-store` (Keychain iOS / Keystore Android) — o
 *     caminho preferido, criptografado pelo sistema e isolado por OS.
 *  2. Se `isAvailableAsync()` retorna `false`, recorre a um fallback
 *     ofuscado em `AsyncStorage` (XOR + HMAC-SHA256 de integridade +
 *     base64). Não é criptografia forte como o Keychain, mas é:
 *      - muito melhor que texto plano (não aparece em `cat` direto);
 *      - resistente a leitura casual por apps sem privilégio;
 *      - válido para uma chave gratuita do Gemini que o usuário pode
 *        revogar a qualquer momento no Google AI Studio.
 *
 * O risco residual (acesso só em aparelho com root + extração do HMAC
 * embutido no bundle) é aceitável neste modelo BYOK onde NENHUMA chave de
 * desenvolvedor está no app e a chave do usuário é revogável.
 *
 * COMPATIBILIDADE WEB: usa apenas TextEncoder/TextDecoder + Uint8Array
 * (padrão do JS, sem `Buffer` do Node) — funciona em React Native nativo
 * (Hermes) e em React Native Web (browser).
 *
 * Esta camada é também o único lugar que sabe o nome da chave — qualquer
 * mudança de nome/keychainService fica isolada aqui.
 *
 * NUNCA logue o valor retornado por `getApiKey()` — ele é um segredo.
 */

const SECURE_KEY = '@lumio/ai-api-key';
const FALLBACK_KEY = '@lumio/ai-api-key-fallback';
const KEYCHAIN_SERVICE = 'lumio-ai';

type WriteableSecureStoreOptions = NonNullable<
  Parameters<typeof SecureStore.setItemAsync>[2]
>;

const secureOptions: WriteableSecureStoreOptions = {
  keychainService: KEYCHAIN_SERVICE,
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

// --- Segredos de ofuscação (não cripto forte — embutidos no bundle) ---
// Uint8Array para funcionar em nativo e web sem dependência de Buffer.
const encoder = new TextEncoder();
const OBF_SECRET = encoder.encode('Lumio2026-ByokObfuscationKey-v1');
const OBF_HMAC_SECRET = encoder.encode('Lumio2026-HmacIntegrityKey-v1');

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

// --- Utilidades de bytes (sem Buffer do Node) -----------------------

function xorBytes(input: Uint8Array<ArrayBuffer>, key: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i++) {
    out[i] = input[i] ^ key[i % key.length];
  }
  return out;
}

function concatBytes(...arrays: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

// base64 codificação — btoa/atob existem em Hermes (React Native) e em
// browser, portanto cobrem nativo e web sem dependência de Buffer.
function bytesToBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function computeHmac(value: Uint8Array<ArrayBuffer>): Promise<string> {
  // HMAC-SHA-256(K, m) = H(K xor opad || H(K xor ipad || m))
  const blockSize = 64;
  let key: Uint8Array<ArrayBuffer> = OBF_HMAC_SECRET;
  if (key.length > blockSize) {
    const h = await sha256(key);
    key = hexToBytes(h);
  }
  if (key.length < blockSize) {
    const padded = new Uint8Array(blockSize);
    padded.set(key);
    key = padded;
  }
  const iPad = xorBytes(key, new Uint8Array(blockSize).fill(0x36));
  const oPad = xorBytes(key, new Uint8Array(blockSize).fill(0x5c));
  const innerHex = await sha256(concatBytes(iPad, value));
  const inner = hexToBytes(innerHex);
  const outerHex = await sha256(concatBytes(oPad, inner));
  return outerHex;
}

function encodeObfuscated(plaintext: string): string {
  const pt = encoder.encode(plaintext);
  const xored = xorBytes(pt, OBF_SECRET);
  return bytesToBase64(xored);
}

function decodeObfuscated(b64: string): string | null {
  const buf = base64ToBytes(b64);
  if (!buf) return null;
  const xored = xorBytes(buf, OBF_SECRET);
  try {
    return new TextDecoder().decode(xored);
  } catch {
    return null;
  }
}

async function encodeWithIntegrity(plaintext: string): Promise<string> {
  const enc = encodeObfuscated(plaintext);
  const encBytes = encoder.encode(enc);
  const hmac = await computeHmac(encBytes);
  return `${hmac}.${enc}`;
}

async function decodeWithIntegrity(stored: string): Promise<string | null> {
  const sep = stored.indexOf('.');
  if (sep <= 0) return decodeObfuscated(stored);
  const expectedHmac = stored.slice(0, sep);
  const enc = stored.slice(sep + 1);
  const encBytes = encoder.encode(enc);
  const recomputed = await computeHmac(encBytes);
  if (recomputed !== expectedHmac) return null; // adulterado/inválido
  return decodeObfuscated(enc);
}

// ---------------------------------------------------------------------

export const secureKeyStorage = {
  /**
   * Devolve a chave bruta do usuário, ou `null` se não houver. Tenta
   * SecureStore primeiro; se indisponível, cai no fallback ofuscado. Só
   * rejeita em falha real (com AIProviderError tipado).
   */
  async getApiKey(): Promise<string | null> {
    if (await isSecureStoreAvailable()) {
      try {
        return await SecureStore.getItemAsync(SECURE_KEY, secureOptions);
      } catch (error) {
        throw new AIProviderError(
          'provider',
          'Não foi possível acessar sua chave de IA salva no dispositivo.',
          error,
        );
      }
    }
    // Fallback ofuscado em AsyncStorage
    try {
      const stored = await AsyncStorage.getItem(FALLBACK_KEY);
      if (!stored) return null;
      return await decodeWithIntegrity(stored);
    } catch {
      return null;
    }
  },

  /**
   * Salva (ou sobrescreve) a chave. Sempre funciona, mesmo sem SecureStore
   * e em web. Rejeita string vazia. Falhas reais de escrita viram
   * AIProviderError.
   */
  async setApiKey(rawKey: string): Promise<void> {
    const key = rawKey.trim();
    if (!key) {
      throw new AIProviderError('invalid-input', 'A chave não pode ser vazia.');
    }
    if (await isSecureStoreAvailable()) {
      try {
        await SecureStore.setItemAsync(SECURE_KEY, key, secureOptions);
        await AsyncStorage.removeItem(FALLBACK_KEY).catch(() => {});
        return;
      } catch (error) {
        throw new AIProviderError(
          'provider',
          'Não foi possível salvar sua chave de IA no dispositivo.',
          error,
        );
      }
    }
    try {
      const encoded = await encodeWithIntegrity(key);
      await AsyncStorage.setItem(FALLBACK_KEY, encoded);
    } catch (error) {
      throw new AIProviderError(
        'provider',
        'Não foi possível salvar sua chave de IA no dispositivo.',
        error,
      );
    }
  },

  /** Remove a chave de ambas as camadas (idempotente — não falha se vazia). */
  async removeApiKey(): Promise<void> {
    if (await isSecureStoreAvailable()) {
      try {
        await SecureStore.deleteItemAsync(SECURE_KEY, secureOptions);
      } catch {
        // ignore — se não existia, ok
      }
    }
    try {
      await AsyncStorage.removeItem(FALLBACK_KEY);
    } catch {
      // ignore
    }
  },

  /** `true` se existe uma chave salva em qualquer camada. */
  async hasApiKey(): Promise<boolean> {
    const key = await this.getApiKey();
    return !!key && key.length > 0;
  },

  /**
   * Versão mascarada para exibição segura em UI: `...ab12`. `null` sem chave.
   * NUNCA devolva a chave completa por aqui.
   */
  async getMaskedApiKey(): Promise<string | null> {
    const key = await this.getApiKey();
    if (!key) return null;
    if (key.length <= 4) return '••••';
    return `...${key.slice(-4)}`;
  },

  /**
   * `true` se SecureStore nativo (preferido) está disponível. Se `false`,
   * o fallback ofuscado é usado automaticamente — não bloqueia mais a UI.
   */
  async isSupported(): Promise<boolean> {
    return isSecureStoreAvailable();
  },
};