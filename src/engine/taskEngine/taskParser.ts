/**
 * Orquestrador do motor determinístico de TAREFAS.
 *
 * Pipeline (ver seção 17 da especificação):
 *   MENSAGEM -> NORMALIZAÇÃO -> DETECÇÃO DE INTENÇÃO -> EXTRAÇÃO DE
 *   ENTIDADES -> RESOLUÇÃO (pessoa/data/tag) -> VALIDAÇÃO -> RESULTADO
 *
 * Mantém a API estável de `parseMessage`/`buildBotResponse` no `regexEngine.ts`
 * — este módulo é consumido quando o domínio é tarefa, enriquecendo o fluxo
 * existente em vez de criar um segundo fluxo paralelo.
 *
 * Função pública principal: `parseTaskMessage(input, context)`.
 */
import { normalizeMessage } from './normalize.ts';
import { assessIntent } from './intentDetector.ts';
import { splitTaskFragments, extractEntities } from './entityExtractor.ts';
import { resolvePerson } from './personResolver.ts';
import { resolveTags } from './tagResolver.ts';
import { humanizeDueDate, resolveTemporal } from './temporal.ts';
import { ACTION_DICTIONARY, resolveAction } from './dictionaries.ts';
import type { TaskParserContext, TaskParseResult, ParsedTask, NormalizedText, TaskEntity } from './types.ts';

/** Versão do motor — útil para logs/TCC. */
export const TASK_ENGINE_VERSION = '2.0.0';

/**
 * Ponto único de entrada. Retorna um `TaskParseResult` com `tasks[]`
 * (0 a N) mesmo quando `intent === 'none'` — neste caso `tasks` é vazio.
 */
export function parseTaskMessage(input: string, context: TaskParserContext): TaskParseResult {
  const normalized = normalizeMessage(input);
  const assessment = assessIntent(normalized);

  if (assessment.intent === 'none') {
    return {
      intent: 'none',
      confidence: assessment.confidence,
      tasks: [],
      reason: assessment.reason,
      originalText: normalized.original,
    };
  }

  // A intenção é criar tarefa — quebrar em múltiplos fragmentos quando aplicável.
  const fragments = splitTaskFragments(normalized);
  // Detecta data compartilhada (aplicada a todos os fragmentos sem data própria).
  const sharedDue = fragments.length > 1 ? detectSharedDueDate(normalized, context.now) : null;
  const tasks: ParsedTask[] = [];

  for (const frag of fragments) {
    const t = buildTask(frag, context, normalized.original, assessment.confidence, assessment.action, sharedDue);
    if (t) tasks.push(t);
  }

  if (tasks.length === 0) {
    return {
      intent: 'none',
      confidence: assessment.confidence,
      tasks: [],
      reason: 'Não foi possível estruturar uma tarefa a partir da mensagem.',
      originalText: normalized.original,
    };
  }

  return {
    intent: 'create_task',
    confidence: assessment.confidence,
    tasks,
    reason: null,
    originalText: normalized.original,
  };
}

function buildTask(fragment: string, context: TaskParserContext, originalText: string, baseConfidence: number, hintAction: string | null, sharedDueDate: string | null): ParsedTask | null {
  const { entity, resolved } = extractEntities(fragment, context.now);

  // Se o fragmento não tem ação recognoscível nem gatilho forte, descartar.
  if (!entity.action && !hasTrigger(fragment)) return null;

  // Resolve pessoa (no fragmento) — validação contra o contexto real.
  // O personResolver é insensível a acento/case, então funciona sobre o
  // fragmento normalizado; o nome próprio (case) só seria útil para pessoas
  // fora do contexto, que o motor não inventa (seção 20).
  const person = resolvePerson(fragment, context.people);

  // Limpa o objeto: remove o nome da pessoa E verbos-gap ("precisa", "vai",
  // "tem", "que") que aparecem entre o sujeito-pessoa e a ação.
  // Ex.: "o joão precisa verificar o orçamento" -> objeto "o orçamento"
  //      em vez de "joão precisa o orçamento".
  const cleanedEntity = cleanObjectFromPerson(entity, person.name);

  // Resolve tags contra o contexto do usuário.
  const tagSource = cleanedEntity.object ? `${cleanedEntity.action ?? ''} ${cleanedEntity.object} ${person.name ?? ''}` : `${cleanedEntity.action ?? ''} ${person.name ?? ''}`;
  const tags = resolveTags(tagSource, { taskTags: context.taskTags, keywordMap: context.keywordMap });

  // Data: usa a resolução já calculada no extractor; herda data compartilhada
  // quando o fragmento não tem a sua (múltiplas tarefas, seção 7).
  const dueDateISO = resolved.dueDate ?? sharedDueDate;
  const dueTime = resolved.dueTime;
  const dueDateLabel = humanizeDueDate(dueDateISO, context.now);

  // Monta o título.
  const title = buildTitle(cleanedEntity, person.name);
  if (!title) return null;

  // Descrição: contexto narrativo extra que não coube no título.
  const description = buildDescription(fragment, title, cleanedEntity, person.name);

  // Confiança individual do fragmento: combina baseConf + presença de objeto/data/pessoa.
  const fragConf = fragmentConfidence(baseConfidence, cleanedEntity, !!person.id, dueDateISO);

  return {
    title,
    description,
    dueDate: dueDateISO,
    dueTime,
    dueDateLabel,
    assigneeId: person.id,
    assigneeName: person.name,
    tags,
    entities: { ...cleanedEntity, personName: person.name },
    confidence: fragConf.score,
    confidenceLevel: fragConf.level,
    originalText,
  };
}

/**
 * Remove do `entity.object` o nome da pessoa resolvida + verbos-gap que
 * aparecem entre o sujeito-pessoa e a ação, produzindo um título limpo.
 *
 * Ex.: "amanhã o João precisa verificar o orçamento"
 *      entity.action = "verificar", entity.object = "joão precisa o orçamento"
 *      person.name = "João Silva"
 *      -> object limpo: "o orçamento" -> título "Verificar O orçamento"
 *
 * Ex.: "o João pediu pra eu verificar o orçamento amanhã"
 *      entity.object = "joão pediu pra eu o orçamento"
 *      -> object limpo: "o orçamento" (remove "joão", "pediu", "pra", "eu")
 */
function cleanObjectFromPerson(entity: TaskEntity, personName: string | null): TaskEntity {
  if (!entity.object || !personName) return entity;
  const personFirst = personName.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (!personFirst || personFirst.length < 3) return entity;

  // Tokens do objeto.
  const tokens = entity.object.split(' ');
  // Remove o primeiro nome da pessoa (e variações com artigo "o/a").
  const GAP_WORDS = new Set([
    'precisa', 'precisamos', 'precisava', 'tem', 'temos', 'tinha',
    'vai', 'vao', 'vão', 'foi', 'foram', 'ia', 'indo',
    'que', 'de', 'da', 'do', 'pra', 'pro', 'para',
    'pediu', 'pediu pra', 'pediu para', 'falou', 'falou pra', 'falou para',
    'disse', 'disse que', 'quer', 'queria', 'quer que',
    'eu', 'nós', 'nos', 'mim', 'ele', 'ela', 'eles', 'elas',
    'me', 'te', 'se', 'lhe',
  ]);

  const cleaned: string[] = [];
  let skipPerson = false;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    // Se for o artigo "o/a" seguido do nome da pessoa, pula ambos.
    if ((tok === 'o' || tok === 'a') && tokens[i + 1] === personFirst) {
      i++; // pula o nome
      skipPerson = true;
      continue;
    }
    // Se for o próprio nome da pessoa.
    if (tok === personFirst) {
      skipPerson = true;
      continue;
    }
    // Se acabamos de pular a pessoa, remove verbos-gap seguintes.
    if (skipPerson && GAP_WORDS.has(tok)) {
      continue;
    }
    skipPerson = false;
    cleaned.push(tok);
  }

  const newObj = cleaned.join(' ').replace(/\s+/g, ' ').trim() || null;
  return { ...entity, object: newObj };
}

/** Herança de data entre múltiplas tarefas (seção 7): se a mensagem tem uma
 * data/temporal que aparece ANTES do primeiro verbo de ação (posição
 * "global"), essa data é aplicada a TODOS os fragmentos que não têm a sua.
 */
function detectSharedDueDate(n: NormalizedText, now: Date): string | null {
  const { resolution, span } = resolveTemporal(n.tokens, now);
  if (!resolution.dueDate || !span) return null;
  // Localiza o primeiro verbo de ação na mensagem.
  let firstActionIdx = -1;
  for (let i = 0; i < n.tokens.length; i++) {
    if (resolveAction(n.tokens[i])) { firstActionIdx = i; break; }
  }
  // Se a data termina antes do primeiro verbo (ou não há verbo), é compartilhada.
  if (firstActionIdx === -1 || span[1] <= firstActionIdx) return resolution.dueDate;
  return null;
}

function hasTrigger(fragment: string): boolean {
  // detectado via INTENT_TRIGGERS — checagem simples
  const triggers = ['preciso', 'tenho que', 'tem que', 'devo', 'me lembra', 'não esquece', 'nao esquece', 'anota', 'coloca', 'adiciona', 'cria', 'fica', 'ficou', 'seria bom', 'quero', 'preciso deixar'];
  return triggers.some((t) => fragment.includes(t));
}

function buildTitle(entity: TaskEntity, personName: string | null): string | null {
  if (!entity.action && !entity.object) return null;

  // Capitaliza a ação (infinitivo) + objeto.
  const actionInf = entity.action ? capitalize(entity.action) : null;

  // Reconstitui o objeto preservando contexto (ex.: "orçamento da obra do cliente da padaria").
  const obj = entity.object ? capitalizeFirst(entity.object) : null;

  let title: string;
  if (actionInf && obj) {
    title = `${actionInf} ${obj}`;
  } else if (actionInf && personName) {
    // "ligar pro João" -> objeto vazio mas pessoa presente
    title = `${actionInf} com ${personName}`;
  } else if (actionInf) {
    title = actionInf;
  } else if (obj) {
    title = obj;
  } else {
    return null;
  }

  // Limita o tamanho do título sem cortar no meio de uma palavra importante.
  if (title.length > 80) title = title.slice(0, 77).trim() + '...';
  return title;
}

function buildDescription(fragment: string, title: string, entity: TaskEntity, personName: string | null): string | null {
  // Se o fragmento original contém muito mais informação que o título,
  // preservamos o contexto extra na descrição.
  const minFragment = fragment.replace(/\s+/g, ' ').trim();
  // Remove do fragmento as marcas já representadas no título (ação + objeto + data + pessoa).
  let leftover = minFragment;
  if (entity.action) {
    const re = new RegExp(escapeReg(entity.action) + '\\b', 'gi');
    leftover = leftover.replace(re, '');
  }
  if (entity.object) leftover = leftover.replace(new RegExp(escapeReg(entity.object), 'gi'), '');
  if (entity.dateExpression) leftover = leftover.replace(new RegExp(escapeReg(entity.dateExpression), 'gi'), '');
  // Remove também o nome da pessoa (primeiro nome e nome completo) — evita
  // descrição residual tipo "O joão precisa" quando a pessoa já está no
  // assigneeName.
  if (personName) {
    const firstName = personName.trim().split(/\s+/)[0] ?? '';
    if (firstName.length >= 3) {
      leftover = leftover.replace(new RegExp(escapeReg(firstName), 'gi'), '');
    }
    leftover = leftover.replace(new RegExp(escapeReg(personName), 'gi'), '');
  }
  // Remove verbos-gap comuns que ficam como resíduo ("precisa", "vai", "tem",
  // "pediu", "falou", "que", "pra", "eu", etc.) — só quando estão isolados.
  const GAP_RE = /\b(?:precisa|precisamos|precisava|tem|temos|tinha|vai|vao|vão|foi|foram|pediu|falou|disse|quer|queria|que|pra|pro|para|de|da|do|eu|nós|nos|mim|ele|ela|eles|elas|me|te|se|lhe)\b/gi;
  leftover = leftover.replace(GAP_RE, ' ');
  leftover = leftover.replace(/\s+/g, ' ').replace(/^[,;: ]+|[,;: ]+$/g, '').trim();

  // Só vale como descrição se sobrou contexto significativo (> 12 chars, palavras reais).
  if (leftover.length < 12) return null;
  if (leftover.length >= minFragment.length - 4) return null; // quase nada foi removido
  // evita trivial ("a de da")
  if (leftover.split(' ').filter((w) => w.length > 2).length < 2) return null;
  return capitalizeFirst(leftover);
}

function fragmentConfidence(base: number, entity: TaskEntity, hasPerson: boolean, hasDate: string | null): { score: number; level: 'alta' | 'media' | 'baixa' } {
  let s = base;
  if (entity.action && entity.object) s = Math.min(1, s + 0.05);
  if (hasDate) s = Math.min(1, s + 0.03);
  if (hasPerson) s = Math.min(1, s + 0.02);
  const score = Math.round(s * 100) / 100;
  const level: 'alta' | 'media' | 'baixa' = score >= 0.75 ? 'alta' : score >= 0.5 ? 'media' : 'baixa';
  return { score, level };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Acesso útil para integração: lista de verbos canônicos suportados (debug/TCC). */
export function supportedActions(): string[] {
  return Object.keys(ACTION_DICTIONARY);
}

// Reexporta utilidades de resolução de ação para testes/integração.
export { resolveAction };