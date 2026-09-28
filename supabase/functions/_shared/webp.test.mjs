import test from 'node:test';
import assert from 'node:assert/strict';
import { readWebpDimensions } from './webp.ts';

function webp(width = 512, height = 400) {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode('RIFF'), 0);
  bytes[4] = 22;
  bytes.set(new TextEncoder().encode('WEBPVP8X'), 8);
  bytes[16] = 10;
  bytes[24] = (width - 1) & 255;
  bytes[25] = ((width - 1) >> 8) & 255;
  bytes[27] = (height - 1) & 255;
  bytes[28] = ((height - 1) >> 8) & 255;
  return bytes;
}
test('accepts bounded non-animated WebP bytes', () => {
  assert.deepEqual(readWebpDimensions(webp()), { width: 512, height: 400 });
});
test('rejects invalid content, oversized dimensions, animation and malformed length', () => {
  const fake = webp(); fake[0] = 0;
  assert.equal(readWebpDimensions(fake), null);
  assert.equal(readWebpDimensions(webp(1025, 400)), null);
  const animated = webp(); animated[20] = 0x02;
  assert.equal(readWebpDimensions(animated), null);
  const truncated = webp(); truncated[4] = 21;
  assert.equal(readWebpDimensions(truncated), null);
});
