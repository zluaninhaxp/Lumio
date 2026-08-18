/**
 * Normalização de texto livre para o motor de tarefas.
 *
 * Princípio fundamental (ver especificação seção 14): NÃO destruir a mensagem
 * original. Mantemos `original` intocado e produzimos uma versão normalizada
 * usada APENAS para análise/matching. A camada abaixo é pura e idempotente.
 *
 * O que a normalização faz:
 *  - trim e colapso de espaços múltiplos;
 *  - conversão para lowercase;
 *  - substituição de pontuação que não carrega significado de tarefa por
 *    espaços (mantém "?", pois sinaliza pergunta — ver `intentDetector`);
 *  - expansão de abreviações comuns (`pra` -> `para`, `pro` -> `para o`...);
 *  - manutenção dos acentos (a remoção de acentos prejudica a extração de
 *    entidades como "João" e verbos acentuados; dois dicionários cobrem as
 *    variações com/sem acento onde for necessário).
 */
import { ABBREVIATIONS } from './dictionaries.ts';
import type { NormalizedText } from './types.ts';

/** Remove acentos de uma string (para match frouxo de tags/nomes quando útil). */
export function stripAccents(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Substitui palavra/composto lower por outro texto, mas somente em limites
 * de palavra para não destruir radicais (ex.: não trocar "que" dentro de
 * "quieto"). Usa boundary simples de espaços/pontuação já normalizada.
 */
function replaceBound(text: string, target: string, replacement: string): string {
  if (!target) return text;
  // boundary: início/fim de string ou caractere não-letra
  const re = new RegExp(
    `(^|[^a-zà-ú0-9])${escapeRegex(target)}(?=$|[^a-zà-ú0-9])`,
    'giu'
  );
  return text.replace(re, (_m, pre: string) => `${pre}${replacement}`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normaliza a mensagem mantendo o original intacto.
 */
export function normalizeMessage(raw: string): NormalizedText {
  const original = raw;
  let text = raw.trim();

  // lowercase
  text = text.toLowerCase();

  // Pontuação: converter tudo que não carrega significado de tarefa em
  // espaço (inclusive ":", "."). Mantém "?" (detector de pergunta) e
  // "/" (datas) e "-" (intervalos).
  text = text.replace(/[!._;,:'"`()]/g, ' ');

  // Colapsar espaços múltiplos.
  text = text.replace(/\s+/g, ' ').trim();

  // Expandir abreviações (em boundary).
  for (const [abbr, expanded] of Object.entries(ABBREVIATIONS)) {
    text = replaceBound(text, abbr, expanded);
  }
  text = text.replace(/\s+/g, ' ').trim();

  const tokens = text ? text.split(' ') : [];
  return { original, text, tokens };
}