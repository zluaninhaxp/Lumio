import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateV1toV2 } from '../migrateV1toV2.ts';
import { resolveEntity } from '../entityResolver.ts';

test('migrates a flattened profile conservatively', () => {
  const profile = migrateV1toV2({ businessName: 'Gesso Silva', segment: 'Gesso', coreCategories: { financial: { expense: ['Material'], income: ['Serviços'] }, taskTags: ['Obras'], calendarEventTypes: ['Visitas'] }, keywordMap: { placa: 'Material' } });
  assert.equal(profile.taxonomyVersion, 2);
  assert.equal(profile.needsReonboardingTaxonomy, true);
  assert.equal(resolveEntity('comprei placa', 'financial.expense', profile.domains['financial.expense']).genericLabel, 'Material');
});
