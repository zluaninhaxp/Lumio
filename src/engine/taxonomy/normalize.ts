const ARTICLES = new Set(['a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'pra', 'pro', 'e']);

export function normalizeTaxonomyText(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim().split(/\s+/)
    .filter((token) => !ARTICLES.has(token))
    .map(singularize)
    .join(' ');
}

function singularize(token: string): string {
  if (token.length <= 4 || /[aeiou]s$/.test(token) || /gas$/.test(token)) return token;
  if (token.endsWith('ões')) return `${token.slice(0, -3)}ao`;
  if (token.endsWith('s')) return token.slice(0, -1);
  return token;
}

export function taxonomyTokens(value: string): string[] {
  return normalizeTaxonomyText(value).split(' ').filter(Boolean);
}

export const normalize = normalizeTaxonomyText;
