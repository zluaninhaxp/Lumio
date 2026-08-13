/**
 * Resolução de TAGS contra o contexto real do usuário.
 *
 * Combina `taskTags` (do onboarding) e `customTaskTags` consolidados no store
 * (chegam aqui como `taskTags`) com o `keywordMap` (palavra/expressão -> tag).
 *
 * Política de segurança (seção 19): melhor NÃO adicionar uma tag do que
 * adicionar uma completamente errada. Matcheamos palavra exata, plural
 * simples e variação de acento — sem associação extremamente agressiva.
 */
import { stripAccents } from './normalize.ts';

interface TagMatchConfig {
  taskTags: string[];
  keywordMap: Record<string, string>;
}

/**
 * Normaliza para matching: lowercase + sem acentos + remove plural simples
 * (s final) para报表 robustez contra "cimento"/"cimentos".
 */
function norm(s: string): string {
  return stripAccents(s.toLowerCase().trim()).replace(/s$/, '');
}

function normKeep(s: string): string {
  return stripAccents(s.toLowerCase().trim());
}

/**
 * Retorna as tags (labels) que se aplicam à mensagem, sem repetir.
 * Considera:
 *  - keywordMap: se a chave aparece na mensagem (word-boundary), aplica a tag
 *    mapeada (desde que ela exista em taskTags);
 *  - taskTags: se a própria label aparece na mensagem (palavra/expressão),
 *    aplica diretamente.
 */
export function resolveTags(text: string, cfg: TagMatchConfig): string[] {
  const { taskTags, keywordMap } = cfg;
  const tags = taskTags && taskTags.length > 0 ? taskTags : [];
  const t = normKeep(text);

  const applied = new Set<string>();
  const apply = (tag: string) => {
    if (tag && !applied.has(tag)) applied.add(tag);
  };

  // 1) keywordMap (palavra -> tag). Só aplica se a tag existir em taskTags.
  for (const [kw, tag] of Object.entries(keywordMap)) {
    const k = normKeep(kw);
    if (!k) continue;
    if (tags.length === 0 || !tags.includes(tag)) continue; // só tags reais
    if (containsWord(t, k)) apply(tag);
  }

  // 2) taskTags diretas
  for (const tag of tags) {
    const tn = normKeep(tag);
    if (containsWord(t, tn)) apply(tag);
    // plural flexão simples
    else if (containsWord(t, tn + 's')) apply(tag);
    else if (containsWord(t, tn.replace(/s$/, ''))) apply(tag);
  }

  return [...applied];
}

function containsWord(haystack: string, needle: string): boolean {
  if (!needle) return false;
  if (needle.length <= 2) return false; // evita tag curta
  const re = new RegExp(`(^|[^\\p{L}])${escapeRegex(needle)}([^\\p{L}]|$)`, 'u');
  return re.test(haystack);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}