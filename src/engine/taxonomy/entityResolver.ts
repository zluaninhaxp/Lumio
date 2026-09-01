import type { EntityResolution, GenericNode, LearnedTerm, SpecificNode, TaxonomyDomain } from './types.ts';
import { normalizeTaxonomyText, taxonomyTokens } from './normalize.ts';

const EMPTY: EntityResolution = { genericId: null, genericLabel: null, specificId: null, specificLabel: null, specificCandidates: [], genericConfidence: 0, specificConfidence: null, matchedTerm: null };

export function resolveEntity(message: string, _domain: TaxonomyDomain, nodes: GenericNode[]): EntityResolution {
  const text = normalizeTaxonomyText(message);
  if (!text || nodes.length === 0) return { ...EMPTY };

  const specificHits = nodes.flatMap((node) => node.specifics.map((specific) => ({ node, specific, term: findTerm(text, [specific.label, ...specific.synonyms]) })) .filter((hit): hit is { node: GenericNode; specific: SpecificNode; term: string } => !!hit.term));
  if (specificHits.length > 0) {
    const unique = uniqueSpecifics(specificHits);
    if (unique.length === 1) {
      const hit = unique[0];
      return result(hit.node, hit.specific, 1, 1, hit.term);
    }
    const first = unique[0];
    return { ...result(first.node, null, 1, null, first.term), specificCandidates: unique.map((hit) => ({ id: hit.specific.id, label: hit.specific.label, score: 1 })) };
  }

  const genericHits = nodes.map((node) => ({ node, term: findTerm(text, [node.generic.label, ...node.generic.synonyms]) })).filter((hit): hit is { node: GenericNode; term: string } => !!hit.term);
  if (genericHits.length > 0) {
    const hit = genericHits[0];
    return { ...result(hit.node, null, 0.9, null, hit.term), specificCandidates: hit.node.specifics.map((s) => ({ id: s.id, label: s.label, score: 1 })) };
  }

  const candidates = nodes.flatMap((node) => [
    ...node.specifics.map((specific) => ({ node, specific, term: bestFuzzy(text, [specific.label, ...specific.synonyms]) })),
    { node, specific: null, term: bestFuzzy(text, [node.generic.label, ...node.generic.synonyms]) },
  ]).filter((hit) => hit.term.score >= 0.8).sort((a, b) => b.term.score - a.term.score);
  if (candidates.length === 0) return { ...EMPTY };
  const best = candidates[0];
  if (best.specific) {
    const candidate = { id: best.specific.id, label: best.specific.label, score: best.term.score };
    if (best.term.score < 0.75) return { ...result(best.node, null, best.term.score, null, best.term.term), specificCandidates: [candidate] };
    return result(best.node, best.specific, best.term.score, best.term.score, best.term.term);
  }
  return result(best.node, null, best.term.score, null, best.term.term);
}

function result(node: GenericNode, specific: SpecificNode | null, genericConfidence: number, specificConfidence: number | null, matchedTerm: string | null): EntityResolution {
  return { genericId: node.id, genericLabel: node.generic.label, specificId: specific?.id ?? null, specificLabel: specific?.label ?? null, specificCandidates: [], genericConfidence, specificConfidence, matchedTerm };
}

function uniqueSpecifics(hits: { node: GenericNode; specific: SpecificNode; term: string }[]) {
  return hits.filter((hit, index, all) => all.findIndex((other) => other.specific.id === hit.specific.id) === index);
}

function findTerm(text: string, values: string[]): string | null {
  return values.map(normalizeTaxonomyText).filter(Boolean).sort((a, b) => b.length - a.length).find((term) => contains(text, term)) ?? null;
}

function contains(text: string, term: string): boolean {
  return ` ${text} `.includes(` ${term} `);
}

function bestFuzzy(text: string, values: string[]): { score: number; term: string | null } {
  const tokens = taxonomyTokens(text);
  return values.map((value) => normalizeTaxonomyText(value)).filter(Boolean).reduce((best, term) => {
    const score = Math.max(editSimilarity(text, term), ...tokens.map((token) => editSimilarity(token, term)));
    return score > best.score ? { score, term } : best;
  }, { score: 0, term: null as string | null });
}

function editSimilarity(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let i = 1; i <= b.length; i++) {
    let previous = rows[0]; rows[0] = i;
    for (let j = 1; j <= a.length; j++) {
      const current = rows[j];
      rows[j] = Math.min(rows[j] + 1, rows[j - 1] + 1, previous + (a[j - 1] === b[i - 1] ? 0 : 1));
      previous = current;
    }
  }
  return 1 - rows[a.length] / Math.max(a.length, b.length, 1);
}

export function recordLearnedTerm(profile: { learnedTerms: LearnedTerm[] }, domain: TaxonomyDomain, rawTermExtracted: string): void {
  const text = rawTermExtracted.trim();
  if (!text) return;
  const existing = profile.learnedTerms.find((term) => term.domain === domain && normalizeTaxonomyText(term.text) === normalizeTaxonomyText(text));
  if (existing) { existing.occurrences += 1; existing.seenAt = new Date().toISOString(); return; }
  profile.learnedTerms.push({ text, domain, resolvedTo: null, seenAt: new Date().toISOString(), occurrences: 1 });
}
