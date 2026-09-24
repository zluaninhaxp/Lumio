/** Parses the first WebP image chunk without trusting a filename or MIME. */
export function readWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30 || bytes.length > 1048576) return null;
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 12) !== 'WEBP') return null;
  const u32 = (offset: number) => bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
  if (u32(4) !== bytes.length - 8) return null;
  const chunkLength = u32(16);
  if (chunkLength < 10 || 20 + chunkLength > bytes.length) return null;
  const chunk = ascii(12, 16);
  let size: { width: number; height: number } | null = null;
  if (chunk === 'VP8X') {
    if (bytes[20] & 0x02) return null;
    size = { width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) };
  } else if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    size = { width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]), height: 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | (bytes[22] >> 6)) };
  } else if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    size = { width: ((bytes[27] & 0x3f) << 8) | bytes[26], height: ((bytes[29] & 0x3f) << 8) | bytes[28] };
  }
  return size && size.width > 0 && size.height > 0 && size.width <= 1024 && size.height <= 1024 ? size : null;
}
