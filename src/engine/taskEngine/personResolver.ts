/**
 * Resolução de PESSOAS contra o contexto real do usuário.
 *
 * Regra não-negociável (especificação seções 20): NUNCA inventar uma pessoa.
 * Consulta a lista real (`people` do contexto). Atribui somente quando há
 * correspondência segura; se houver ambiguidade (vários matches), devolve
 * o nome mas NÃO devolve id, deixando a UI decidir.
 *
 * O motor chama resolvePerson com o texto ORIGINAL (case preservado), o que
 * permite extrair nomes próprios (capitalizados) como candidato, e faz a
 * validação contra a lista real por matching insensível a acento/case.
 */
import type { PersonRef } from './types.ts';
import { stripAccents } from './normalize.ts';

interface PersonaKey {
  id: string;
  name: string;
  /** lower + sem acento */
  full: string;
  /** parte(s) nome-próprio (primeiro nome + eventual segundo nome próprio) */
  parts: string[];
}

export function resolvePerson(text: string, people: PersonRef[]): {
  name: string | null;
  id: string | null;
  ambiguous: boolean;
} {
  if (!people || people.length === 0) return { name: null, id: null, ambiguous: false };

  const norm = (s: string) => stripAccents(s.toLowerCase().trim());
  const search = norm(text);
  const keys: PersonaKey[] = people.map((p) => {
    const full = norm(p.name);
    const rawParts = p.name.trim().split(/\s+/);
    // considera como "part" qualquer token próprio (capitalizado no original),
    // mas para matching usamos os 1-2 primeiros tokens lower/sem acento.
    const parts = rawParts.slice(0, 2).map(norm).filter(Boolean);
    return { id: p.id, name: p.name, full, parts };
  });

  // 1) Match de nome COMPLETO (forte). Se um único matchear, resolve direto.
  const fullMatches = keys.filter((k) => containsWord(search, k.full));
  if (fullMatches.length === 1) {
    return { name: fullMatches[0].name, id: fullMatches[0].id, ambiguous: false };
  }
  if (fullMatches.length > 1) {
    // múltiplos nomes completos presentes — ambíguo
    return { name: fullMatches[0].name, id: null, ambiguous: true };
  }

  // 2) Match por PRIMEIRO NOME (fraco). Pode haver ambiguidade.
  const firstToken = (k: PersonaKey) => k.parts[0];
  const byFirst = new Map<string, PersonaKey[]>();
  for (const k of keys) {
    const fn = firstToken(k);
    if (!fn || fn.length <= 2) continue;
    if (containsWord(search, fn)) {
      const arr = byFirst.get(fn) ?? [];
      arr.push(k);
      byFirst.set(fn, arr);
    }
  }

  // Junta todas as pessoas casadas por primeiro nome.
  const matchedPeople: PersonaKey[] = [];
  for (const arr of byFirst.values()) for (const k of arr) matchedPeople.push(k);
  const distinctIds = new Set(matchedPeople.map((k) => k.id));

  if (distinctIds.size === 1) {
    const k = matchedPeople[0];
    return { name: k.name, id: k.id, ambiguous: false };
  }
  if (distinctIds.size > 1) {
    return { name: matchedPeople[0].name, id: null, ambiguous: true };
  }

  // 3) Ninguém da lista foi achada — sem inventar. Tentamos apenas extrair um
  // nome próprio candidato do texto original para usar no título (sem id).
  const candidate = extractProperNoun(text);
  if (candidate) return { name: candidate, id: null, ambiguous: false };

  return { name: null, id: null, ambiguous: false };
}

/** Conta ocorrência com boundary de não-letra. */
function containsWord(haystack: string, needle: string): boolean {
  if (!needle || needle.length <= 2) return false;
  const re = new RegExp(`(^|[^\\p{L}])${escapeRegex(needle)}([^\\p{L}]|$)`, 'u');
  return re.test(haystack);
}

/** Extrai um nome próprio (capitalizado) imediatamente após preposição comum. */
function extractProperNoun(original: string): string | null {
  const patterns = [
    /(?:atribui(?:r)?\s+(?:esta|essa|a|)?\s*tarefa\s+(?:pro|para o|para a|pra o|pra a|pra|para)\s+)([\p{Lu}\p{Lt}][\p{L}'.\-]+(?:\s+[\p{Lu}\p{Lt}][\p{L}'.\-]+){0,2})/u,
    /(?:pro|para o|para a|pra o|pra a|pra|para|com)\s+(?:o\s+|a\s+)?([\p{Lu}\p{Lt}][\p{L}'.\-]+(?:\s+[\p{Lu}\p{Lt}][\p{L}'.\-]+){0,2})/u,
  ];
  for (const re of patterns) {
    const m = original.match(re);
    if (m && m[1]) {
      let name = m[1].trim();
      // corta conectores verbais finais comuns
      name = name.replace(/\s+(vai|precisa|tem|que|de|da|do|para|pro|com)$/i, '').trim();
      return name;
    }
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}