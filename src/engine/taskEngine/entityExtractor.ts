/**
 * Extração de ENTIDADES para o domínio de tarefas.
 *
 * Dado o texto normalizado, separa: ação, objeto, pessoa (menção), data/hora
 * e prazo. A resolução de pessoa/data contra o contexto é feita em outros
 * módulos; aqui apenas identificamos e isolamos os trechos consumidos para
 * construir um título/objeto limpo.
 */
import { resolveAction } from './dictionaries.ts';
import { resolveTemporal, type TemporalResolution } from './temporal.ts';
import type { NormalizedText, TaskEntity } from './types.ts';

/** Palavras "function words" que não carregam significado de objeto. */
const FILLER = new Set([
  'que', 'de', 'da', 'do', 'das', 'dos', 'um', 'uma', 'uns', 'umas',
  'o', 'a', 'os', 'as', 'e', 'pra', 'pro', 'para', 'para o', 'para a',
  'com', 'sem', 'no', 'na', 'nos', 'nas', 'isso', 'aquilo', 'aquele', 'essa',
  'esse', 'este', 'esta', 'meu', 'minha', 'nosso', 'nossa',
  'eu', 'ele', 'ela', 'vocês', 'voce', 'vc', 'agora', 'já', 'ja',
  'preciso', 'precisamos', 'precisa', 'tenho', 'tem', 'temos', 'devo', 'devemos',
  'lembra', 'lembre', 'lembrar', 'anota', 'anote', 'anotar',
  'não', 'nao',
]);

/** Delimitadores que separam múltiplas tarefas (ver seção 7). */
const MULTI_DELIMS = /\s+(?:e|,|;\s*|depois)\s+/i;

export interface ExtractedFragment {
  /** Texto deste fragmento (sub-mensagem) já normalizado. */
  fragment: string;
  /** Entidades extraídas deste fragmento. */
  entity: TaskEntity;
  /** Resolução temporal completa (já com ISO calculado) — evita re-resolver. */
  resolved: TemporalResolution;
  /** Tokens restantes após remover data/hora (para montar título). */
  residualTokens: string[];
}

/**
 * Quebra a mensagem em múltiplos fragmentos quando há delimitadores de
 * múltiplas tarefas E cada lado contém um verbo de ação próprio. Sem isso,
 * não forçamos múltiplas tarefas (regra de não-ambiguidade da seção 7).
 */
export function splitTaskFragments(n: NormalizedText): string[] {
  if (!n.text) return [];

  // Primeiro tenta separar por delimitador. Mantém os delimitadores
  // descobertos para evitar splits burros ("comprar cimento, areia e brita"
  // NÃO são 3 tarefas — é UM objeto com lista).
  // Heurística: só separa quando cada lado possui verbo de ação próprio.
  const roughParts = roughSplit(n.text);
  if (roughParts.length <= 1) return [n.text];

  const valid = roughParts.filter((p) => hasOwnAction(p));
  // Se só um lado tem ação, é objeto composto, NÃO múltiplas tarefas.
  if (valid.length <= 1) return [n.text];
  return valid;
}

function roughSplit(text: string): string[] {
  // Divide em " e " e "," mas mantém listas que vêm após mesmo verbo.
  // Estratégia: split por " e " / "," e depois reúne pedaços que não têm verbo
  // próprio no pedaço anterior (lista de objetos).
  const raw = text.split(/,|;\s*|\s+e\s+|\s+depois\s+/i).map((p) => p.trim()).filter(Boolean);
  if (raw.length <= 1) return raw;
  // Reúne pedaços sem ação no pedaço anterior (lista de objetos).
  const merged: string[] = [];
  for (const part of raw) {
    if (hasOwnAction(part) || merged.length === 0) {
      merged.push(part);
    } else {
      // anexa como lista de objetos ao último fragmento
      merged[merged.length - 1] = merged[merged.length - 1] + ', ' + part;
    }
  }
  return merged;
}

function hasOwnAction(text: string): boolean {
  for (const tok of text.split(' ')) {
    if (resolveAction(tok)) return true;
  }
  // compostos
  if (/(entrar em contato|mandar mensagem|dar retorno|fazer orçamento|fazer orcamento|deixar pronto)/.test(text)) return true;
  return false;
}

/**
 * Extrai entidades de UM fragmento (sub-mensagem).
 */
export function extractEntities(fragment: string, now: Date): ExtractedFragment {
  const tokens = fragment ? fragment.split(' ') : [];

  // 1) Data/hora — resolve temporal e remove os tokens consumidos.
  const { resolution, span } = resolveTemporal(tokens, now);
  let residualTokens = tokens.slice();
  let dateExpression: string | null = null;
  let timeExpression: string | null = null;
  let isDeadline = false;
  if (span) {
    residualTokens = tokens.slice(0, span[0]).concat(tokens.slice(span[1]));
    dateExpression = resolution.expression;
    timeExpression = resolution.dueTime;
    isDeadline = resolution.isDeadline;
  }
  // Também remove marcadores de prazo "até" residuais se temporal não casou.
  residualTokens = residualTokens.filter((t) => t !== 'até' && t !== 'ate' && t !== 'para' && t !== 'pra' && t !== 'antes' && t !== 'depois');

  // 2) Ação — primeiro token que casa um verbo de ação.
  let action: string | null = null;
  let actionIndex = -1;
  for (let i = 0; i < residualTokens.length; i++) {
    const a = resolveAction(residualTokens[i]);
    if (a) { action = a; actionIndex = i; break; }
  }
  // Ação composta
  if (!action) {
    const joined = residualTokens.join(' ');
    if (joined.includes('entrar em contato')) action = 'falar';
    else if (joined.includes('mandar mensagem')) action = 'enviar';
    else if (joined.includes('dar retorno')) action = 'responder';
    else if (joined.includes('fazer orçamento') || joined.includes('fazer orcamento')) action = 'orcar';
    else if (joined.includes('fazer cotação') || joined.includes('fazer cotacao')) action = 'cotar';
    else if (joined.includes('deixar pronto')) action = 'preparar';
  }

  // 3) Remove ação verbo-e-formas (imperativo/conjugado) do residual.
  // Remove também gatilhos de intenção que não pertencem ao objeto.
  let objTokens = residualTokens.slice();
  if (actionIndex >= 0) {
    objTokens = objTokens.filter((_, i) => i !== actionIndex);
  }

  // Remove conectores de gatilho que vêm ANTES da ação ("preciso", "tenho que", ...).
  objTokens = stripLeadingTriggers(objTokens);

  // Remove wrappers de lembrete/explícito que poluem o início do objeto.
  objTokens = stripWrapperPhrases(objTokens);

  // Remove menções de atribuição que ficam no objeto ("pro João", "para a Maria").
  objTokens = stripAssigneeMarkers(objTokens);

  // Limpa filler no início/fim (mas mantém conectores internos do objeto).
  objTokens = trimFiller(objTokens);

  // Se restou wrapper no meio (ex.: "comprar ... de esquecer"), uma 2ª passada.
  objTokens = stripWrapperPhrases(objTokens);
  objTokens = trimFiller(objTokens);

  const objectStr = objTokens.join(' ').trim() || null;

  const entity: TaskEntity = {
    action,
    object: objectStr,
    personName: null, // resolvido em personResolver; aqui só isolamos texto
    dateExpression,
    timeExpression,
    isDeadline,
  };

  return {
    fragment,
    entity,
    resolved: resolution,
    residualTokens,
    // Para montar título usamos algo mais limpo — exposition abaixo em taskParser.
  };
}

/** Remove palavras iniciais de gatilho de intenção que vêm antes da ação. */
function stripLeadingTriggers(tokens: string[]): string[] {
  const starts = ['preciso', 'precisamos', 'precisa', 'tenho', 'tem', 'temos', 'devo', 'devemos', 'devia', 'deveria',
    'lembra', 'lembre', 'lembrar', 'anota', 'anote', 'anotar', 'adiciona', 'adicione', 'adicionar', 'aí', 'ai',
    'cria', 'crie', 'criar', 'coloca', 'coloque', 'colocar', 'inclui', 'inclua', 'incluir',
    'fala', 'fale', 'pede', 'peça', 'peca', 'bota', 'põe', 'pone', 'registra', 'registre'];
  let i = 0;
  while (i < tokens.length && (starts.includes(tokens[i]) || tokens[i] === 'que' || tokens[i] === 'de' || tokens[i] === 'q')) i++;
  // não remover se for a própria ação (ex.: "comprar")
  return tokens.slice(i);
}

/** Remove wrapper phrases de lembrete/planejamento que poluem o objeto. */
function stripWrapperPhrases(tokens: string[]): string[] {
  const phrases: string[][] = [
    ['não', 'posso', 'esquecer', 'de'],
    ['nao', 'posso', 'esquecer', 'de'],
    ['não', 'esquece', 'de'],
    ['nao', 'esquece', 'de'],
    ['não', 'posso', 'esquecer'],
    ['me', 'lembra', 'de'],
    ['me', 'lembre', 'de'],
    ['me', 'lembrar', 'de'],
    ['me', 'lembra'],
    ['me', 'lembre'],
    ['nova', 'tarefa'],
    ['uma', 'tarefa'],
    ['tarefa', 'nova'],
    ['enota', 'aí'],
    ['anota', 'aí'],
    ['anota', 'ai'],
    ['adiciona', 'uma', 'tarefa'],
    ['adiciona', 'tarefa'],
    ['cria', 'uma', 'tarefa'],
    ['coloca', 'pra', 'eu'],
    ['coloca', 'pro', 'eu'],
    ['faz', 'pra', 'mim'],
    ['fala', 'pra', 'eu'],
    ['faz', 'pra', 'eu'],
    ['quero'],
    ['queria'],
    ['preciso', 'que'],
    ['preciso', 'deixar', 'isso'],
  ];
  let out = tokens.slice();
  for (const p of phrases) {
    out = removePrefix(out, p);
  }
  return out;
}

function removePrefix(tokens: string[], prefix: string[]): string[] {
  if (tokens.length < prefix.length) return tokens;
  for (let i = 0; i < prefix.length; i++) {
    if (tokens[i] !== prefix[i]) return tokens;
  }
  return tokens.slice(prefix.length);
}

/** Tira "pro/para o + nome" do objeto quando vier em formato curto. */
function stripAssigneeMarkers(tokens: string[]): string[] {
  const idx = tokens.findIndex((t, i) => (t === 'pro' || t === 'pra' || t === 'para' || t === 'com') && /^[\p{L}]/u.test(tokens[i + 1] ?? '') && i > 1);
  if (idx >= 0) {
    // corta a partir da preposição de pessoa (pessoa fica para o resolver)
    return tokens.slice(0, idx);
  }
  // "o João" / "a Maria" no início
  if (tokens.length >= 2 && (tokens[0] === 'o' || tokens[0] === 'a') && /^[A-ZÀ-Ú]/u.test(tokens[1] ?? '')) {
    // Esta heurística só tem efeito sobre o texto normalizado (lower). Como
    // normalizamos pra lower, não dá pra diferenciar "o João" de "o orçamento".
    // Por isso deixamos a resolução de pessoa no personResolver, que tem a lista real.
  }
  return tokens;
}

function trimFiller(tokens: string[]): string[] {
  let start = 0;
  let end = tokens.length;
  while (start < end && FILLER.has(tokens[start])) start++;
  while (end > start && FILLER.has(tokens[end - 1])) end--;
  return tokens.slice(start, end);
}