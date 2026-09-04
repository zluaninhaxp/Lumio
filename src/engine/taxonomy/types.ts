export type Origin = 'mentioned' | 'suggested' | 'learned';

export interface SpecificNode {
  id: string;
  label: string;
  synonyms: string[];
  origin: Origin;
}

export interface GenericNode {
  id: string;
  generic: { label: string; synonyms: string[] };
  specifics: SpecificNode[];
}

export type TaxonomyDomain = 'financial.expense' | 'financial.income' | 'task' | 'calendar';

export interface LearnedTerm {
  text: string;
  domain: TaxonomyDomain;
  resolvedTo: { genericId: string; specificId: string | null } | null;
  seenAt: string;
  occurrences: number;
}

export interface LearnedIntentMarker {
  phrase: string;
  domain: 'task' | 'calendar' | 'financial';
  resolution: string;
  occurrences: number;
  lastSeenAt: string;
}

export interface BusinessTaxonomy {
  taxonomyVersion: 2;
  businessName: string | null;
  segment: string | null;
  summary: string;
  domains: Record<TaxonomyDomain, GenericNode[]>;
  recommendedPlugins: { plugin: string; reason: string; confidence: 'alta' | 'media' | 'baixa' }[];
  missingInformation: string[];
  learnedTerms: LearnedTerm[];
  needsReonboardingTaxonomy?: boolean;
}

export interface EntityResolution {
  genericId: string | null;
  genericLabel: string | null;
  specificId: string | null;
  specificLabel: string | null;
  specificCandidates: { id: string; label: string; score: number }[];
  genericConfidence: number;
  specificConfidence: number | null;
  matchedTerm: string | null;
}

/** Returns normalized synonyms which occur more than once in a domain. */
export function validateTaxonomy(domain: GenericNode[]): string[] {
  const seen = new Map<string, string>();
  const conflicts = new Set<string>();
  for (const node of domain) {
    const values = [...node.generic.synonyms, ...node.specifics.flatMap((s) => s.synonyms)];
    for (const value of values) {
      const key = value.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!key) continue;
      if (seen.has(key)) conflicts.add(key);
      else seen.set(key, node.id);
    }
  }
  return [...conflicts];
}
