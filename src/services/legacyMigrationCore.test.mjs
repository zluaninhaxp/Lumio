import test from 'node:test';
import assert from 'node:assert/strict';
import { equivalentJson, migrateOnce } from './legacyMigrationCore.ts';

test('JSON confirmation ignores object key order', () => {
  assert.equal(equivalentJson({ a: 1, nested: { y: 2, x: 3 } }, { nested: { x: 3, y: 2 }, a: 1 }), true);
});

test('retry after confirmed migration does not duplicate writes', async () => {
  let remote = null;
  let legacy = { id: 'old-1' };
  let writes = 0;
  let removals = 0;
  const run = () => migrateOnce({
    legacy, readRemote: async () => remote,
    writeRemote: async (value) => { remote = value; writes++; },
    equivalent: (a, b) => a.id === b.id,
    removeLegacy: async () => { legacy = null; removals++; },
  });
  await run();
  await run();
  assert.equal(writes, 1);
  assert.equal(removals, 1);
});

test('failed remote write or confirmation preserves the old copy', async () => {
  let removed = false;
  await assert.rejects(migrateOnce({
    legacy: { id: 'old-2' }, readRemote: async () => null,
    writeRemote: async () => { throw new Error('network'); },
    equivalent: (a, b) => a.id === b.id,
    removeLegacy: async () => { removed = true; },
  }));
  assert.equal(removed, false);
  await assert.rejects(migrateOnce({
    legacy: { id: 'old-2' }, readRemote: async () => null,
    writeRemote: async () => {},
    equivalent: (a, b) => a.id === b.id,
    removeLegacy: async () => { removed = true; },
  }));
  assert.equal(removed, false);
});
