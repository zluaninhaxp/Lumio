/**
 * Orquestrador do motor determinístico de CALENDÁRIO.
 *
 * Pipeline (especificação seções 2/3/4/12/34):
 *   MENSAGEM -> NORMALIZAÇÃO -> DETECÇÃO DE INTENÇÃO -> EXTRAÇÃO
 *   TEMPORAL (+ PERÍODO/HORÁRIO/DURAÇÃO) -> EXTRAÇÃO DE PESSOA ->
 *   CLASSIFICAÇÃO DE TIPO -> RESULTADO HÍBRIDO
 *
 * Reutiliza explicitamente o motor de tarefas (`taskEngine`):
 *  - `taskEngine/normalize.ts` para normalização (idempotente);
 *  - `taskEngine/temporal.ts` para resolução de datas/horários/períodos;
 *  - `taskEngine/personResolver.ts` para resolução de pessoas (não inventa);
 *  - os mesmos marcadores de NEG/PASSADO/PERGUNTA como primeiro filtro.
 *
 * A saída NÃO substitui o `TaskParseResult`: o `chat.tsx` continua chamando
 * `parseTaskMessage` para decisões de TAREFA, e chama `parseCalendarMessage`
 * para decidir EVENTO independente + quando uma tarefa deve gerar
 * representação no calendário (ver `decideHybrid` em `interpret.ts`).
 */
import { normalizeMessage, stripAccents } from '../taskEngine/normalize.ts';
import { resolveTemporal, humanizeDueDate } from '../taskEngine/temporal.ts';
import type { TemporalResolution } from '../taskEngine/temporal.ts';
import { resolvePerson } from '../taskEngine/personResolver.ts';
import { ACTION_DICTIONARY, NEGATION_MARKERS, PAST_DONE_MARKERS, QUESTION_MARKERS } from '../taskEngine/dictionaries.ts';
import {
  COMPROMISSO_MARKERS,
  CALENDAR_NEGATION_MARKERS,
  CALENDAR_PAST_MARKERS,
  DEADLINE_LEADS,
  DEFAULT_EVENT_TYPE_ALIASES,
} from './dictionaries.ts';
import type {
  CalendarParseResult,
  CalendarParserContext,
  ParsedCalendarEvent,
  ParsedTaskCalendarLink,
} from './types.ts';

/** Versão do motor — útil para logs/TCC. */
export const CALENDAR_ENGINE_VERSION = '1.0.0';

const MIN_CONF = 0.45;

/** Monteia tabela de aliases por tipo de evento usando o onboarding + defaults. */
export function buildEventTypeAliases(
  calendarEventTypes: string[]
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const label of calendarEventTypes) {
    const key = stripAccents(label.toLowerCase().trim());
    const defaults = DEFAULT_EVENT_TYPE_ALIASES[label] ?? [];
    // Adiciona o próprio label (singular/plural simples) e seus defaults.
    out.set(key, dedupe([key, ...expandLabelVariants(label), ...defaults.map((a) => stripAccents(a.toLowerCase()))]));
  }
  return out;
}

function expandLabelVariants(label: string): string[] {
  const out: string[] = [];
  const norm = stripAccents(label.toLowerCase().trim());
  out.push(norm);
  if (norm.endsWith('s')) out.push(norm.slice(0, -1));
  else out.push(norm + 's');
  // verbos comuns derivados ("visitas" -> "visita"/"visitar")
  const verbMap: Record<string, string[]> = {
    visit: ['visitar', 'visitei', 'visita'],
    entreg: ['entregar', 'entreguei', 'entrega'],
    reun: ['reunião', 'reunir', 'reuni'],
    compr: ['compromisso'],
  };
  for (const k of Object.keys(verbMap)) {
    if (norm.startsWith(k)) out.push(...verbMap[k].map((v) => stripAccents(v.toLowerCase())));
  }
  return out;
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs.filter(Boolean)));
}

/** Ponto único de entrada. Interpreta a mensagem do ponto de vista do calendário. */
export function parseCalendarMessage(
  input: string,
  context: CalendarParserContext
): CalendarParseResult {
  const normalized = normalizeMessage(input);
  const text = normalized.text;
  const noneResult = (reason: string): CalendarParseResult => ({
    intent: 'none',
    confidence: 0,
    events: [],
    reason,
    originalText: normalized.original,
    normalized,
  });

  if (!text) return noneResult('Mensagem vazia.');

  // --- 1) Filtros (reaproveita marcadores do taskEngine + calendar) ---
  // Negatção de calendário é checada primeiro porque tem palavras específicas.
  const calNeg = CALENDAR_NEGATION_MARKERS.find((m) => text.includes(m));
  if (calNeg) return noneResult(`Negatção de calendário: "${calNeg}".`);

  // Negatção estrutural ("não vou", "não tenho que").
  const structNeg = NEGATION_MARKERS.find((m) => text.includes(m));
  if (structNeg) return noneResult(`Marcador de negação: "${structNeg}".`);

  // Passado explícito de evento — "ontem tive reunião".
  const pastHit = CALENDAR_PAST_MARKERS.find((m) => text.includes(m));
  if (pastHit) return noneResult(`Evento passado já ocorrido: "${pastHit}".`);

  // Passado de ação concluída ("já comprei").
  const pastDone = PAST_DONE_MARKERS.find((m) => text.includes(m));
  if (pastDone && pastDone !== 'ontem' && pastDone !== 'anteontem') {
    // Não necessariamente descarta o calendário, mas sinaliza cuidado. Para
    // evitar criar eventos de coisas já feitas, baixamos confiança: só
    // descartamos quando também não há compromisso explícito.
    const hasCompromisso = COMPROMISSO_MARKERS.some((m) => text.includes(m));
    if (!hasCompromisso) return noneResult(`Indica ação já realizada: "${pastDone}".`);
  }

  // Perguntas -> não criar evento.
  const questionHit = QUESTION_MARKERS.some((m) => m === '?' ? /\?/.test(text) : text.includes(m));
  if (questionHit) return noneResult('Parece uma pergunta.');

  // --- 2) Resolução temporal (REAPROVEITADA do taskEngine) ---
  const { resolution } = resolveTemporal(normalized.tokens, context.now);
  const hasDate = !!resolution.dueDate;

  // --- 2b) Guarda de data PASSADA (integração Financeiro): o temporal
  // agora resolve "ontem"/"há N dias"/"semana passada" para o motor
  // financeiro registrar retroativos. O calendário é orientado a futuro —
  // nunca cria evento/representação em data que já passou.
  if (hasDate && isPastISO(resolution.dueDate!, context.now)) {
    return noneResult('Referência temporal no passado — sem representação de calendário.');
  }

  // --- 3) Detecção de markers de compromisso ---
  const compromissoHits = COMPROMISSO_MARKERS.filter((m) => text.includes(m));
  const hasCompromisso = compromissoHits.length > 0;

  // --- 4) Detecção de ação executável (pega emprestado do taskEngine) ---
  // Usamos `resolveAction` indiretamente checando dicionário simples — sem
  // duplicar; apenas indicando se há verbo de ação reconheíéscível.
  const hasAction = detectAnyAction(text);
  const isDeadlineContext = DEADLINE_LEADS.some((m) => text.includes(m)) || resolution.isDeadline;

  // --- 5) DECISÃO de intenção (híbrido) ---
  // (a) Compromisso explícito + data -> evento (seção 12/13)
  // (b) Compromisso + data + ação executável concomitante -> tarefa + evento (seção 25)
  // (c) Ação executável + data -> tarefa + representação no calendário (seção 14)
  // (d) Compromisso sem data -> evento implícito de hoje (? mantemosNONE BLEND)
  //     decay: se não há data nem horário bl`é fato convecidente, ensa fraca.
  let intent: CalendarParseResult['intent'] = 'none';
  let confidence = 0;

  if (hasCompromisso && hasDate) {
    if (hasAction && detectMultipleIntents(text)) {
      intent = 'create_task_and_event';
      confidence = 0.85;
    } else {
      intent = 'create_event';
      confidence = compromissoHits.length >= 2 ? 0.9 : 0.75;
    }
  } else if (hasAction && hasDate) {
    // tarefa + representação no calendário (source='task')
    intent = 'create_task_with_calendar';
    confidence = 0.7;
} else if (hasCompromisso && !hasDate) {
    // Compromisso sem data explícita — não criamos evento arbitrando "hoje"
    // ( especificação: não inventar). Sinalização fraca: NONE.
    intent = 'none';
    confidence = 0.2;
  }

  if (intent === 'none' || confidence < MIN_CONF) {
    return noneResult('Sem intenção de calendário suficiente (sem data/compromisso confiável).');
  }

  // --- 6) Construção dos resultados ---
  const eventTypeAliases = buildEventTypeAliases(context.calendarEventTypes);
  const person = resolvePerson(normalized.original, [...context.people]);
  const eventType = classifyEventType(text, eventTypeAliases, context.calendarEventTypes, context.keywordMap, compromissoHits);

  const out: CalendarParseResult = {
    intent,
    confidence: round(confidence),
    events: [],
    reason: null,
    originalText: normalized.original,
    normalized,
  };

  if (intent === 'create_event' || intent === 'create_task_and_event') {
    // Pode haver múltiplos eventos (seção 26) — split por delimitadores.
    out.events = extractMultipleEvents(normalized, context, eventTypeAliases, compromissoHits);
    if (out.events.length === 0) {
      // Fallback: monta um único evento da mensagem toda.
      const ev = buildEvent(normalized, resolution, person, eventType, context);
      if (ev) out.events = [ev];
    }
  }

  if (intent === 'create_task_with_calendar' || intent === 'create_task_and_event') {
    // Instruction para o chat calendarizar a tarefa correspondente (a própria
    // mensagem virá também do taskEngine com sua tarefa). Aqui só produzimos
    // a instrução; o chat decide aplicar.
    out.taskCalendar = {
      date: resolution.dueDate!,
      time: resolution.dueTime,
      deadline: isDeadlineContext && intent === 'create_task_with_calendar',
      eventType,
      hasExplicitTime: !!resolution.dueTime,
    };
  }

  if (out.events.length === 0 && !out.taskCalendar) {
    return noneResult('Sem dados suficientes para criar evento/calendário.');
  }

  return out;
}

/**
 * Decide a intenção híbrida entre taskEngine e calendarEngine.
 *
 * Recebe o resultado do taskEngine (`taskAlready`) e do calendarEngine
 * (`calendar`). Princípios:
 *  - Evento derivado de tarefa (calendar.taskCalendar) é priorizado NUNCA
 *    criar segundo evento independente (evitar duplicidade, seção 15).
 *  - Evento independente (calendar.events) coexiste com a tarefa quando
 *    `intent === 'create_task_and_event'`.
 *  - Quando ambos concordam (ex.: taskEngine detects task, calendar detects
 *    event), aplicamos as regras da seção 36.
 */
export interface HybridCalendarDecision {
  /** Criar evento(s) independente(s) no calendário (source='chat'). */
  events: ParsedCalendarEvent[];
  /** Calendariar a tarefa já reconhecida pelo taskEngine (+ criar derivado). */
  taskCalendar?: ParsedTaskCalendarLink;
  /** True se deve criar/calendariar alguma coisa no calendário. */
  shouldCreateInCalendar: boolean;
  /** Razão humana (debug/UI fallback). */
  reason: string | null;
}

export function decideHybrid(
  calendar: CalendarParseResult,
  hasTaskFromTaskEngine: boolean,
  hasDateFromTaskEngine: boolean
): HybridCalendarDecision {
  if (calendar.intent === 'none' || calendar.confidence < MIN_CONF) {
    // Mesmo se calendar disse NONE, podemos ainda assim calendarizar a
    // tarefa quando o taskEngine reconheu tarefa COM data significativa.
    if (hasTaskFromTaskEngine && hasDateFromTaskEngine) {
      // Tarefa tem data: o próprio taskEngine já devolveu dueDate. O chat
      // sempre cria o derivado quando há dueDate.
      return {
        events: [],
        taskCalendar: undefined, // o chat decide criar pela dueDate da tarefa
        shouldCreateInCalendar: false, // marcamos false porque o chat vai
                                       // calendarizar independentemente
        reason: 'calendar.NONE mas tarefa com data — chat cria derivado.',
      };
    }
    return { events: [], shouldCreateInCalendar: false, reason: 'nenhuma intenção de calendário' };
  }

  if (calendar.intent === 'create_event') {
    return {
      events: calendar.events,
      taskCalendar: undefined,
      shouldCreateInCalendar: true,
      reason: null,
    };
  }
  if (calendar.intent === 'create_task_with_calendar') {
    return {
      events: [],
      taskCalendar: calendar.taskCalendar,
      shouldCreateInCalendar: true,
      reason: null,
    };
  }
  if (calendar.intent === 'create_task_and_event') {
    // Tarefa + evento independente adicionais.
    return {
      events: calendar.events,
      taskCalendar: calendar.taskCalendar,
      shouldCreateInCalendar: true,
      reason: null,
    };
  }
  return { events: [], shouldCreateInCalendar: false, reason: 'sem intenção' };
}

// ─── funções auxiliares ───────────────────────────────────────────

function detectAnyAction(text: string): boolean {
  // Reaproveita o dicionário de ações do taskEngine — sem duplicar regras.
  for (const canon of Object.keys(ACTION_DICTIONARY)) {
    const variants = ACTION_DICTIONARY[canon];
    for (const v of variants) {
      if (v && text.includes(v)) return true;
    }
    if (text.includes(canon)) return true;
  }
  return false;
}

function detectMultipleIntents(text: string): boolean {
  // Heurística ("compromisso + segunda cláusula de ação"):
  // procura por "e" / "," / "e preciso" / "e tenho que" / "e vou" / etc.
  return /\s+(?:e|,)\s+(?:preciso|tenho que|devo|vou|tem que|precisa)/i.test(text);
}

function classifyEventType(
  text: string,
  aliases: Map<string, string[]>,
  calendarEventTypes: string[],
  keywordMap: Record<string, string>,
  compromissoHits: string[]
): string | null {
  if (calendarEventTypes.length === 0) return null;
  const t = stripAccents(text.toLowerCase());

  // 1) Aliases diretos da=tabela default + variantes por tipo do onboarding.
  let best: { label: string; score: number } | null = null;
  for (const label of calendarEventTypes) {
    const key = stripAccents(label.toLowerCase().trim());
    const aliasesFor = aliases.get(key) ?? [];
    let score = 0;
    for (const a of aliasesFor) {
      if (!a) continue;
      if (text.includes(stripAccents(a))) score++; // com acento já incluido
      else if (t.includes(a)) score++;
    }
    if (compromissoHits.length > 0 && best !== null && score > best.score) {
      best = { label, score };
    } else if (!best || score > best.score) {
      if (score > 0) best = { label, score };
    }
  }
  if (best) return best.label;

  // 2) keywordMap auxiliar — só aplica se o valor existir em calendarEventTypes.
  for (const [kw, val] of Object.entries(keywordMap)) {
    if (!calendarEventTypes.includes(val)) continue;
    const k = stripAccents(kw.toLowerCase());
    if (t.includes(k)) return val;
  }

  return null;
}

function extractMultipleEvents(
  normalized: ReturnType<typeof normalizeMessage>,
  context: CalendarParserContext,
  aliases: Map<string, string[]>,
  compromissoHits: string[]
): ParsedCalendarEvent[] {
  // Split por delimitadores de múltiplos compromissos (seção 26).
  // Só separa quando cada lado possui um compromisso próprio, para não
  // falsamente quebrar ("reunião com João e Carlos" é um evento).
  // IMPORTANTE: split sobre o texto BRUTO (`normalized.original`) porque
  // `normalizeMessage` remove vírgulas — sem isso, 3 eventos viram 1.
  const parts = splitEventFragmentsRaw(normalized.original);
  if (parts.length <= 1) return [];
  // Filtra fragmentos que possuem um compromisso próprio.
  const valid = parts.filter((p) => {
    const np = normalizeMessage(p);
    return COMPROMISSO_MARKERS.some((m) => np.text.includes(m));
  });
  if (valid.length <= 1) return [];

  const events: ParsedCalendarEvent[] = [];
  // Data compartilhada global (quando a primeira data aparece antes do
  // primeiro compromisso — ver seção 7). Caso contrário, cada fragmento
  // resolve sua própria data.
  const { resolution } = resolveTemporal(normalized.tokens, context.now);
  // Não exigimos data global: se cada fragmento tem a sua, usamos a sua.
  for (const p of valid) {
    const person = resolvePerson(p, [...context.people]);
    const frag = normalizeMessage(p);
    const eventType = classifyEventType(frag.text, aliases, context.calendarEventTypes, context.keywordMap, compromissoHits);
    // Shadow temporal para este fragmento.
    const fragFull = resolveTemporal(frag.tokens, context.now);
    const date = fragFull.resolution.dueDate ?? resolution.dueDate;
    const time = fragFull.resolution.dueTime ?? resolution.dueTime ?? null;
    if (!date) continue; // sem data, não cria evento (não inventa)
    // Residual sem temporal para o título.
    const residualTokens = fragFull.span
      ? frag.tokens.slice(0, fragFull.span[0]).concat(frag.tokens.slice(fragFull.span[1]))
      : frag.tokens.slice();
    const residualText = residualTokens.join(' ').replace(/\s+/g, ' ').trim();
    const title = buildEventTitle(residualText, person.name);
    if (!title) continue;
    events.push({
      title,
      date,
      time,
      personName: person.name,
      personId: person.id,
      eventType,
      context: extractContext(residualText, title),
      hasExplicitTime: !!time,
      confidence: 0.7,
      confidenceLevel: 'media',
      originalText: normalized.original,
    });
  }
  return events;
}

/** Split bruto por vírgula, ponto-e-vírgula, " e ", " depois ". */
function splitEventFragmentsRaw(text: string): string[] {
  return text
    .split(/,|;|\s+e\s+|\s+depois\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Conectores que introduzem uma cláusula de contexto (a partir daqui é
 *  descrição adicional, não título). O título para antes deles. */
const CONTEXT_INTRODUCERS = ['para', 'pra', 'pro', 'sobre', 'a respeito', 'referente'];

/**
 * Padrões que introduzem uma CLÁUSULA DE TAREFA após um compromisso.
 * Ex.: "reunião com João e preciso levar o orçamento" — o evento é só
 * "Reunião com João"; "preciso levar o orçamento" é tarefa.
 */
const TASK_CLAUSE_PATTERNS = [
  /\s+e\s+preciso\b/i,
  /\s+e\s+tenho\s+que\b/i,
  /\s+e\s+temos\s+que\b/i,
  /\s+e\s+tenho\s+q\b/i,
  /\s+e\s+devo\b/i,
  /\s+e\s+vou\b/i,
  /\s+e\s+tem\s+que\b/i,
  /\s+e\s+precisa\s+de\b/i,
  /\s+e\s+quero\b/i,
  /\s+e\s+não\s+posso\s+esquecer\b/i,
  /\s+e\s+nao\s+posso\s+esquecer\b/i,
  /\s+e\s+me\s+lembra\b/i,
  /\s+e\s+anota\b/i,
  /\s+e\s+adiciona\b/i,
  /\s+e\s+coloca\b/i,
  /\s+e\s+cria\b/i,
];

function buildEventTitle(fragment: string, personName: string | null): string | null {
  // 1) Limpa preenchidos iniciais (verbos de estado, artigos, "uma/um").
  let s = fragment.replace(/\s+/g, ' ').trim();
  s = s.replace(/^(?:eu\s+)?(?:tenho|vou|tem|é|eh|e|a|o|uma|um|minha|meu)\s+/i, '');
  s = s.replace(/^(?:vou|tem|tenho)\s+(?:a|à|na|no|em|estar|ficar)\s+/i, '');
  // 2) Corta no primeiro conector de contexto ("para falar..."/"sobre ...").
  let cutIdx = -1;
  for (const c of CONTEXT_INTRODUCERS) {
    const idx = s.toLowerCase().indexOf(' ' + c + ' ');
    if (idx > 0 && (cutIdx === -1 || idx < cutIdx)) cutIdx = idx;
  }
  // 2b) Corta em cláusulas de TAREFA ("e preciso levar...", "e tenho que...").
  for (const pat of TASK_CLAUSE_PATTERNS) {
    const m = s.match(pat);
    if (m && m.index !== undefined) {
      if (cutIdx === -1 || m.index < cutIdx) cutIdx = m.index;
    }
  }
  let titlePart = s;
  if (cutIdx > 0) titlePart = s.slice(0, cutIdx).trim();
  if (!titlePart) titlePart = s;
  // 3) Capitaliza.
  return capitalizeFirst(titlePart);
}

function buildEvent(
  normalized: ReturnType<typeof normalizeMessage>,
  resolution: TemporalResolution,
  person: { name: string | null; id: string | null; ambiguous: boolean },
  eventType: string | null,
  context: CalendarParserContext
): ParsedCalendarEvent | null {
  if (!resolution.dueDate) return null;
  // Reconstrói tokens sem a porção temporal (span) para o título/contexto.
  const fullRes = resolveTemporal(normalized.tokens, context.now);
  const residualTokens = fullRes.span
    ? normalized.tokens.slice(0, fullRes.span[0]).concat(normalized.tokens.slice(fullRes.span[1]))
    : normalized.tokens.slice();
  const residualText = residualTokens.join(' ').replace(/\s+/g, ' ').trim();
  const title = buildEventTitle(residualText, person.name);
  if (!title) return null;
  return {
    title,
    date: resolution.dueDate,
    time: resolution.dueTime ?? null,
    personName: person.name,
    personId: person.id,
    eventType,
    context: extractContext(residualText, title),
    hasExplicitTime: !!resolution.dueTime,
    confidence: 0.78,
    confidenceLevel: 'alta',
    originalText: normalized.original,
  };
}

function extractContext(fragment: string, title: string): string | null {
  // Extrai a cláusula de contexto: o que aparece DEPOIS do título no
  // fragmento, tipicamente introduzida por "para"/"pra"/"sobre"/"de"/"da".
  const norm = fragment.replace(/\s+/g, ' ').trim();
  const tLower = title.toLowerCase();
  // Encontra onde o título termina no fragmento.
  const idx = norm.toLowerCase().indexOf(tLower);
  if (idx < 0) return null;
  const after = norm.slice(idx + tLower.length).trim();
  if (!after) return null;
  // Limpa conectores iniciais sobressalentes.
  const cleaned = after.replace(/^[,;: ]+/, '').trim();
  if (cleaned.length < 8) return null;
  // Heurística: só vale como contexto se sobrar pelo menos 2 palavras
  // significativas (>=3 chars).
  const words = cleaned.split(' ').filter((w) => w.length >= 3);
  if (words.length < 2) return null;
  return capitalizeFirst(cleaned);
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** True quando o ISO YYYY-MM-DD é estritamente anterior a `now`. */
function isPastISO(iso: string, now: Date): boolean {
  const target = new Date(`${iso}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return target.getTime() < today.getTime();
}
function round(x: number): number {
  return Math.round(x * 100) / 100;
}

// Reexporta utilidades para testes/integração.
export { resolveTemporal, humanizeDueDate };