import assert from 'node:assert/strict';
import test from 'node:test';
import { fitWebpWithinLimit, PHOTO_MAX_BYTES, PHOTO_MAX_DIMENSION, PHOTO_WEBP_QUALITIES } from './photoOptimizationCore.ts';

test('retries lower WebP qualities and returns only a result within 1 MB', async () => {
  const attempted = [];
  const sizes = [PHOTO_MAX_BYTES + 300000, PHOTO_MAX_BYTES + 10, 180000];
  const result = await fitWebpWithinLimit(async (quality) => {
    attempted.push(quality);
    return { size: sizes[attempted.length - 1], width: PHOTO_MAX_DIMENSION, height: 384 };
  });
  assert.deepEqual(attempted, PHOTO_WEBP_QUALITIES.slice(0, 3));
  assert.equal(result.size, 180000);
});

test('stops after the bounded attempts when no optimized file fits', async () => {
  let attempts = 0;
  await assert.rejects(
    fitWebpWithinLimit(async () => { attempts++; return { size: PHOTO_MAX_BYTES + 1 }; }),
    /otimizar a foto/,
  );
  assert.equal(attempts, PHOTO_WEBP_QUALITIES.length);
});
