/**
 * SHA-256 puro em JS — sem dependência de `node:crypto` (indisponível no
 * runtime Hermes do React Native). Usado apenas para HMAC de integridade
 * do fallback ofuscado da chave de IA (ver `secureKeyStorage.ts`), onde
 * criptografia forte via sistema não está disponível.
 *
 * Implementação baseada na specs do NIST FIPS 180-4; não é constante-time
 * mas suficiente para integridade de ofuscação (não para segredo de
 * sistema). Retorna hex string (lowercase).
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function toUint32(x: number): number {
  return x >>> 0;
}

/**
 * Calcula o SHA-256 de um Uint8Array e devolve hex (lowercase).
 * Compatível com React Native nativo (Hermes) e React Native Web (browser)
 * — não depende de `Buffer` do Node.
 */
export function sha256(data: Uint8Array<ArrayBuffer>): Promise<string> {
  // Pré-processamento: padding conforme FIPS 180-4
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const bitLen = bytes.length * 8;
  // padding: 0x80, depois zeros, depois 64-bit big-endian length; total % 512 == 0
  const withOne = bytes.length + 1;
  const totalLen = withOne + 8 + ((withOne + 8) % 64 === 0 ? 0 : 64 - ((withOne + 8) % 64));
  const buf = new Uint8Array(totalLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  // length em bits, big-endian, 64 bits
  const lenOffset = totalLen - 8;
  let hi = Math.floor(bitLen / 0x100000000);
  let lo = bitLen >>> 0;
  buf[lenOffset] = (hi >>> 24) & 0xff;
  buf[lenOffset + 1] = (hi >>> 16) & 0xff;
  buf[lenOffset + 2] = (hi >>> 8) & 0xff;
  buf[lenOffset + 3] = hi & 0xff;
  buf[lenOffset + 4] = (lo >>> 24) & 0xff;
  buf[lenOffset + 5] = (lo >>> 16) & 0xff;
  buf[lenOffset + 6] = (lo >>> 8) & 0xff;
  buf[lenOffset + 7] = lo & 0xff;

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  for (let i = 0; i < totalLen; i += 64) {
    const w = new Uint32Array(64);
    for (let j = 0; j < 16; j++) {
      const off = i + j * 4;
      w[j] = toUint32((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]);
    }
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = toUint32(w[j - 16] + s0 + w[j - 7] + s1);
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = toUint32(h + S1 + ch + K[j] + w[j]);
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = toUint32(S0 + mj);
      h = g;
      g = f;
      f = e;
      e = toUint32(d + t1);
      d = c;
      c = b;
      b = a;
      a = toUint32(t1 + t2);
    }
    h0 = toUint32(h0 + a);
    h1 = toUint32(h1 + b);
    h2 = toUint32(h2 + c);
    h3 = toUint32(h3 + d);
    h4 = toUint32(h4 + e);
    h5 = toUint32(h5 + f);
    h6 = toUint32(h6 + g);
    h7 = toUint32(h7 + h);
  }

  const hex = (x: number) => x.toString(16).padStart(8, '0');
  return Promise.resolve(`${hex(h0)}${hex(h1)}${hex(h2)}${hex(h3)}${hex(h4)}${hex(h5)}${hex(h6)}${hex(h7)}`);
}