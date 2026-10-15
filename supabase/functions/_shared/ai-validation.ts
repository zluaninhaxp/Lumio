import type { OnboardingContextDTO } from './onboarding-prompt.ts';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const nullableText = (v: unknown) => v === null || text(v);
export function validContext(value: unknown): value is OnboardingContextDTO {
  if (!object(value) || typeof value.submittedAt !== 'string' || !Number.isFinite(Date.parse(value.submittedAt))) return false;
  if (typeof value.businessNameGuess !== 'string' || typeof value.businessTypeGuess !== 'string') return false;
  if (!Array.isArray(value.answers) || value.answers.length < 1 || value.answers.length > 6) return false;
  return value.answers.every(a => object(a) && text(a.blockId) && text(a.question) && text(a.answer) && a.answer.length <= 15000 && a.question.length <= 2000);
}

/** Validate every field consumed by the app before returning a provider result. */
export function parsePersonalization(raw: string): Record<string, unknown> | null {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const v = JSON.parse(cleaned);
    if (!object(v) || v.taxonomyVersion !== 2 || !nullableText(v.businessName) || !nullableText(v.segment) || !text(v.summary) || !object(v.domains)) return null;
    for (const domain of ['financial.expense', 'financial.income', 'task', 'calendar']) {
      const nodes = v.domains[domain];
      if (!Array.isArray(nodes) || nodes.length > 100) return null;
      if (!nodes.every(n => object(n) && text(n.id) && object(n.generic) && text(n.generic.label) && strings(n.generic.synonyms) && Array.isArray(n.specifics) && n.specifics.every(s => object(s) && text(s.id) && text(s.label) && strings(s.synonyms) && ['mentioned', 'suggested', 'learned'].includes(s.origin as string)))) return null;
    }
    if (!strings(v.missingInformation) || !Array.isArray(v.recommendedPlugins) || !v.recommendedPlugins.every(p => object(p) && text(p.plugin) && typeof p.reason === 'string' && ['alta', 'media', 'baixa'].includes(p.confidence as string))) return null;
    // This field describes terms learned later from chat, never from model output.
    v.learnedTerms = [];
    return v;
  } catch { return null; }
}
