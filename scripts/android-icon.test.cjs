const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { getJimpImageAsync } = require('@expo/image-utils/build/jimp');
const config = require('../app.json').expo;

test('Android mascot has green clearance inside the launcher masked viewport', async () => {
  const image = await getJimpImageAsync(path.resolve(config.android.adaptiveIcon.foregroundImage));
  const { width, height, data } = image.bitmap;
  assert.equal(width, height);
  assert.ok(width >= 1024);
  assert.notEqual(config.android.adaptiveIcon.foregroundImage, config.icon, 'adaptive icon needs its own padding');
  let minX = width, minY = height, maxX = 0, maxY = 0, white = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (data[i + 3] > 220 && data[i] > 210 && data[i + 1] > 210 && data[i + 2] > 210) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y); white++;
    }
  }
  assert.ok(white > width * height * 0.015, 'mascot remains legible');
  assert.ok((maxY - minY) / height <= 0.48, 'mascot must not fill the adaptive layer');
  // Android masks the central 72/108 region. Even the circular mask must leave
  // green around the entire mascot bounding box, including its curled tip.
  const radius = width * 72 / 108 / 2;
  for (const x of [minX, maxX]) for (const y of [minY, maxY]) {
    assert.ok(Math.hypot(x - width / 2, y - height / 2) < radius * 0.94);
  }
  const corner = data.subarray(0, 4);
  assert.ok(corner[1] > corner[0] && corner[1] > corner[2], 'full green background');
  console.log(`Mascot: ${((maxX - minX) / width * 100).toFixed(1)}% wide, ${((maxY - minY) / height * 100).toFixed(1)}% high`);
});
