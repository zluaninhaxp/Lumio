import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordLearnedTerm, resolveEntity } from '../entityResolver.ts';
import type { GenericNode } from '../types.ts';

const nodes: GenericNode[] = [{ id: 'material', generic: { label: 'Material', synonyms: ['materiais'] }, specifics: [
  { id: 'placa_gesso', label: 'Placa de Gesso', synonyms: ['placas de gesso'], origin: 'mentioned' },
  { id: 'ferragens', label: 'Ferragens', synonyms: ['parafusos'], origin: 'suggested' },
] }];

test('resolve specific without inferring it from generic', () => {
  const specific = resolveEntity('gastei 500 em placas de gesso', 'financial.expense', nodes);
  assert.equal(specific.genericLabel, 'Material');
  assert.equal(specific.specificLabel, 'Placa de Gesso');
  assert.equal(resolveEntity('gastei 500 em material', 'financial.expense', nodes).specificId, null);
});

test('normalizes accents and returns candidates for generic-only evidence', () => {
  const result = resolveEntity('material', 'financial.expense', nodes);
  assert.equal(result.genericId, 'material');
  assert.deepEqual(result.specificCandidates.map((candidate) => candidate.label), ['Placa de Gesso', 'Ferragens']);
});

test('does not invent a specific on a miss', () => {
  assert.equal(resolveEntity('cimento', 'task', nodes).specificId, null);
});

test('recordLearnedTerm deduplicates by domain and normalized text', () => {
  const profile = { learnedTerms: [] as { text: string; domain: 'task'; resolvedTo: null; seenAt: string; occurrences: number }[] };
  recordLearnedTerm(profile, 'task', 'Gizmo');
  recordLearnedTerm(profile, 'task', ' gizmo ');
  assert.equal(profile.learnedTerms.length, 1);
  assert.equal(profile.learnedTerms[0].occurrences, 2);
});
