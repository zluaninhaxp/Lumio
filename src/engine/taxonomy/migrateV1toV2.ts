import type { BusinessTaxonomy, GenericNode, TaxonomyDomain } from './types.ts';

export interface LegacyBusinessProfile {
  businessName?: string | null;
  segment?: string | null;
  summary?: string;
  coreCategories?: { financial?: { expense?: string[]; income?: string[] }; taskTags?: string[]; calendarEventTypes?: string[] };
  taskTags?: string[];
  calendarEventTypes?: string[];
  keywordMap?: Record<string, string>;
  recommendedPlugins?: BusinessTaxonomy['recommendedPlugins'];
  missingInformation?: string[];
}

export function migrateV1toV2(oldProfile: LegacyBusinessProfile): BusinessTaxonomy {
  const map = oldProfile.keywordMap ?? {};
  const labels: Record<TaxonomyDomain, string[]> = {
    'financial.expense': oldProfile.coreCategories?.financial?.expense ?? [],
    'financial.income': oldProfile.coreCategories?.financial?.income ?? [],
    task: oldProfile.coreCategories?.taskTags ?? oldProfile.taskTags ?? [],
    calendar: oldProfile.coreCategories?.calendarEventTypes ?? oldProfile.calendarEventTypes ?? [],
  };
  const domains = Object.fromEntries((Object.keys(labels) as TaxonomyDomain[]).map((domain) => [domain, labels[domain].map((label) => nodeFor(label, map))])) as BusinessTaxonomy['domains'];
  return { taxonomyVersion: 2, businessName: oldProfile.businessName ?? null, segment: oldProfile.segment ?? null, summary: oldProfile.summary ?? '', domains, recommendedPlugins: oldProfile.recommendedPlugins ?? [], missingInformation: oldProfile.missingInformation ?? [], learnedTerms: [], needsReonboardingTaxonomy: true };
}

function nodeFor(label: string, keywordMap: Record<string, string>): GenericNode {
  return { id: slug(label), generic: { label, synonyms: Object.entries(keywordMap).filter(([, value]) => value === label).map(([key]) => key) }, specifics: [] };
}

function slug(value: string): string { return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'categoria'; }
