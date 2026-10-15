import type { CategorySuggestion, OnboardingExtractionResult } from './types';
import type { TaxonomyDomain } from '../engine/taxonomy/types';

export type ReportListKey = 'expense' | 'income' | 'calendar' | 'task';

const domainByKey: Record<ReportListKey, TaxonomyDomain> = {
  expense: 'financial.expense', income: 'financial.income', calendar: 'calendar', task: 'task',
};

export function getReportItems(report: OnboardingExtractionResult, key: ReportListKey): CategorySuggestion[] {
  if (key === 'expense') return report.coreCategories.financial.expense;
  if (key === 'income') return report.coreCategories.financial.income;
  if (key === 'calendar') return report.coreCategories.calendarEventTypes;
  return report.coreCategories.taskTags;
}

export function editReportOverview(report: OnboardingExtractionResult, values: { businessName: string; segment: string; summary: string }): OnboardingExtractionResult {
  const businessName = values.businessName.trim() || null;
  const segment = values.segment.trim() || null;
  const summary = values.summary.trim();
  return {
    ...report, businessName, segment, summary,
    taxonomy: report.taxonomy ? { ...report.taxonomy, businessName, segment, summary } : undefined,
  };
}

export function editReportList(report: OnboardingExtractionResult, key: ReportListKey, labels: string[]): OnboardingExtractionResult {
  const previous = getReportItems(report, key);
  const next = labels.map((label, index) => ({ label: label.trim(), origin: previous.find((item) => item.label === label.trim())?.origin ?? (labels.length === previous.length ? previous[index]?.origin : undefined) ?? 'suggested' } as CategorySuggestion));
  const coreCategories = {
    financial: { ...report.coreCategories.financial },
    taskTags: report.coreCategories.taskTags,
    calendarEventTypes: report.coreCategories.calendarEventTypes,
  };
  if (key === 'expense' || key === 'income') coreCategories.financial[key] = next;
  else if (key === 'calendar') coreCategories.calendarEventTypes = next;
  else coreCategories.taskTags = next;

  const renamed = new Map(previous.map((item, index) => [item.label, next.some((candidate) => candidate.label === item.label) ? item.label : (next.length === previous.length ? next[index]?.label : undefined)]));
  const keywordMap = Object.fromEntries(Object.entries(report.keywordMap).flatMap(([term, label]) => {
    if (!renamed.has(label)) return [[term, label]];
    const replacement = renamed.get(label);
    return replacement ? [[term, replacement]] : [];
  }));
  const domain = domainByKey[key];
  const oldNodes = report.taxonomy?.domains[domain] ?? [];
  const nodes = next.map((item, index) => {
    const old = oldNodes.find((node) => node.generic.label === item.label) ?? (next.length === previous.length ? oldNodes[index] : undefined);
    return old ? { ...old, generic: { ...old.generic, label: item.label, synonyms: [item.label, ...old.generic.synonyms.filter((value) => value !== previous[index]?.label && value !== item.label)] } }
      : { id: `manual-${domain.replace('.', '-')}-${Date.now()}-${index}`, generic: { label: item.label, synonyms: [item.label] }, specifics: [] };
  });
  const taxonomy = report.taxonomy ? {
    ...report.taxonomy,
    domains: { ...report.taxonomy.domains, [domain]: nodes },
    learnedTerms: report.taxonomy.learnedTerms.filter((term) => term.domain !== domain || !term.resolvedTo || nodes.some((node) => node.id === term.resolvedTo?.genericId)),
  } : undefined;
  return { ...report, coreCategories, keywordMap, taxonomy };
}
