import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { gcm } from '@noble/ciphers/aes';
import { bytesToHex, hexToBytes, utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils';

type IO = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
  keyGet: (key: string) => Promise<string | null>;
  keySet: (key: string, value: string) => Promise<void>;
  keyRemove: (key: string) => Promise<void>;
  random: (length: number) => Promise<Uint8Array>;
  keys?: () => Promise<string[]>;
};
/** AES-GCM authenticates the storage key as AAD; moving ciphertext between users fails. */
export function createProtectedStorage(io: IO) {
  const locks = new Map<string, Promise<unknown>>();
  const slot = (key: string) => 'lumio.local.' + bytesToHex(utf8ToBytes(key));
  async function secret(key: string): Promise<Uint8Array> {
    const name = slot(key);
    const saved = await io.keyGet(name);
    if (saved) return hexToBytes(saved);
    const bytes = await io.random(32);
    await io.keySet(name, bytesToHex(bytes));
    return bytes;
  }
  async function locked<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = locks.get(key) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(fn);
    locks.set(key, current);
    try { return await current; } finally { if (locks.get(key) === current) locks.delete(key); }
  }
  async function write(key: string, value: string) {
    const nonce = await io.random(12);
    const cipher = gcm(await secret(key), nonce, utf8ToBytes(key));
    const encrypted = cipher.encrypt(utf8ToBytes(value));
    const envelope = JSON.stringify({ lumioEncrypted: 1, nonce: bytesToHex(nonce), ciphertext: bytesToHex(encrypted) });
    // Small records keep a single atomic write. Large journals avoid Android's
    // per-row CursorWindow limit; publish the manifest only after every part.
    if (envelope.length <= 256_000) await io.set(key, envelope);
    else {
      const prefix = key + '.enc.' + bytesToHex(nonce) + '.';
      const parts = Math.ceil(envelope.length / 256_000);
      if (parts > 128) throw new Error('Rascunho local muito grande. Solicite suporte.');
      for (let index = 0; index < parts; index++) await io.set(prefix + index, envelope.slice(index*256_000,(index+1)*256_000));
      await io.set(key,JSON.stringify({ lumioChunks:1,prefix,parts }));
    }
    // Once published, remove obsolete encrypted generations. Keep the current
    // nonce parts; failed cleanup never removes the new durable generation.
    const names=await io.keys?.() ?? [];
    const activePrefix=envelope.length > 256_000 ? key+'.enc.'+bytesToHex(nonce)+'.' : null;
    for(const name of names) if(name.startsWith(key+'.enc.') && (!activePrefix || !name.startsWith(activePrefix))) await io.remove(name);
  }
  return {
    getItem(key: string): Promise<string | null> { return locked(key, async () => {
      let raw = await io.get(key);
      if (raw === null) return null;
      let envelope;
      try { envelope = JSON.parse(raw); } catch { envelope = null; }
      if (envelope?.lumioChunks === 1) {
        if (typeof envelope.prefix !== 'string' || !envelope.prefix.startsWith(key + '.enc.') || !Number.isInteger(envelope.parts) || envelope.parts < 1 || envelope.parts > 128) throw new Error('Manifesto do rascunho inválido. A cópia foi preservada.');
        const parts: string[] = [];
        for (let index=0;index<envelope.parts;index++) {
          const part=await io.get(envelope.prefix+index);
          if(part===null) throw new Error('Rascunho incompleto. Solicite suporte antes de apagar os dados.');
          parts.push(part);
        }
        raw=parts.join(''); envelope=JSON.parse(raw);
      }
      if (envelope?.lumioEncrypted === 1) {
        // Never generate a replacement key for existing ciphertext.
        const saved = await io.keyGet(slot(key));
        if (!saved) throw new Error('Proteção local indisponível. Solicite suporte antes de apagar dados do aparelho.');
        try { return bytesToUtf8(gcm(hexToBytes(saved), hexToBytes(envelope.nonce), utf8ToBytes(key)).decrypt(hexToBytes(envelope.ciphertext))); }
        catch { throw new Error('Não foi possível verificar o rascunho protegido. A cópia foi preservada.'); }
      }
      // Upgrade legacy plaintext only after a successful authenticated write.
      await write(key, raw);
      return raw;
    }); },
    setItem(key: string, value: string) { return locked(key, () => write(key, value)); },
    removeItem(key: string) { return locked(key, async () => {
      const names=await io.keys?.() ?? [];
      for(const name of names) if(name.startsWith(key+'.enc.')) await io.remove(name);
      await io.remove(key); await io.keyRemove(slot(key));
    }); },
  };
}

// Native encryption keys remain in Android Keystore/iOS Keychain via SecureStore.
// Browser previews use ordinary browser storage; no claim of hardware protection.
const native = createProtectedStorage({
  get: key => AsyncStorage.getItem(key), set: (key,value) => AsyncStorage.setItem(key,value), remove: key => AsyncStorage.removeItem(key),
  keyGet: key => SecureStore.getItemAsync(key),
  keySet: (key,value) => SecureStore.setItemAsync(key,value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  keyRemove: key => SecureStore.deleteItemAsync(key), random: length => Crypto.getRandomBytesAsync(length),
  keys: () => AsyncStorage.getAllKeys().then(keys => [...keys]),
});
export const protectedStorage = Platform.OS === 'web' ? AsyncStorage : native;
