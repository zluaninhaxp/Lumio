/**
 * Tipos do motor de interpretação de CALENDÁRIO.
 *
 * Camada complementar ao `taskEngine` (mesma arquitetura híbrida
 * Regex/regras). NÃO duplica o parser temporal — reutiliza
 * `taskEngine/temporal.ts`, `taskEngine/normalize.ts` e
 * `taskEngine/personResolver.ts`. A diferença está na DECISÃO de intenção
 * (compromisso/evento vs tarefa) e na classificação de tipo de evento
 * usando `coreCategories.calendarEventTypes` (onboarding).
 *
 * Conceitos (ver especificação, seções 4/12-15/22-24/28-29):
 *  - `create_event`: mensagem puramente de compromisso (reunião, visita,
 *    aniversário) — gera `CalendarEvent` independente (`source='chat'`).
 *  - `create_task`: mensagem de tarefa SEM data relevante — fica só no
 *    domínio de tarefas (não tem representação de calendário obrigatória).
 *  - `create_task_with_calendar`: tarefa com referência temporal
 *    significativa (data de execução OU prazo) — gera tarefa + calendario
 *    derivado (`source='task'`, 1:1).
 *  - `create_task_and_event`: mensagem com DUAS intenções distintas (ex.:
 *    "reunião com João e preciso levar o orçamento" — ver seção 25). Ambos
 *    são criados, compartilham contexto temporal.
 *  - `none`: negação, passado, pergunta ou insuficiência.
 *
 * Os tipos aqui são INTERMEDIÁRIOS entre a mensagem e o store — o schema
 * persistido (`CalendarEvent`/`Task` em `src/store/index.ts`) é preservado.
 */

import type { ConfidenceLevel, NormalizedText } from '../taskEngine/types.ts';

/** Referência de tipo de evento do onboarding (`calendarEventTypes`). */
export interface CalendarEventTypeRef {
  label: string;
  /** Palavras/expressões adicionais que casam com este tipo (ex.: "reunião"). */
  aliases: string[];
}

/** Contexto real do usuário injetado no parser de calendário. */
export interface CalendarParserContext {
  /** Data/hora atual — base para datas relativas (igual ao taskEngine). */
  now: Date;
  /** Tipos de evento gerados pelo onboarding (`calendarEventTypes`). */
  calendarEventTypes: string[];
  /** keywordMap do onboarding — suporte complementar à classificação. */
  keywordMap: Record<string, string>;
  /** Pessoas reais (mesma lista do taskEngine) — para reúso. */
  people: ReadonlyArray<{ id: string; name: string }>;
}

/** Origem reconhecida para o evento (quando criado do chat). */
export type CalendarEventSource = 'chat' | 'task';

/**
 * Estrutura de um evento reconhecido a partir do chat, antes da
 * persistência. Equivale ao `CalendarEvent` do store, mas sem `id`/`done` e
 * com campos suplementares para o fluxo (`deadline`, `eventType`).
 */
export interface ParsedCalendarEvent {
  /** Título/descrição útil (ex.: "Reunião com o fornecedor"). */
  title: string;
  /** ISO YYYY-MM-DD. */
  date: string;
  /** HH:MM ou null quando só período (manhã/tarde/noite) ou vazio. */
  time: string | null;
  /** Pessoa mencionada (string, sem inventar) — referência textual/real. */
  personName: string | null;
  /** Id de pessoa resolvida (do contexto real), quando houver match seguro. */
  personId: string | null;
  /** Classificação via `calendarEventTypes` do onboarding, se casar. */
  eventType: string | null;
  /** Contexto extra preservado (ex.: "para falar do orçamento da obra"). */
  context: string | null;
  /** True quando horário fornecido explicitamente (não inventado). */
  hasExplicitTime: boolean;
  /** Confiança 0..1. */
  confidence: number;
  /** Confiança em nível. */
  confidenceLevel: ConfidenceLevel;
  /** Texto original do usuário. */
  originalText: string;
}

/**
 * Instrução de calendariAR uma tarefa — produzida quando uma tarefa (já
 * reconhecida pelo taskEngine) tem referência temporal significativa. É
 * uma ESPECIFICAÇÃO adicional ao `ParsedTask`; o store decide criar
 * efetivamente o `CalendarEvent` derivado.
 */
export interface ParsedTaskCalendarLink {
  /** ISO YYYY-MM-DD (prazo ou data de execução). */
  date: string;
  /** HH:MM ou null. */
  time: string | null;
  /** True quando `date` é um PRAZO (deadline), não execução pontual. */
  deadline: boolean;
  /** Classificação sugerida (via calendarEventTypes). */
  eventType: string | null;
  /** True se há horário explícito (não inventado). */
  hasExplicitTime: boolean;
}

/** Resultado completo do parser de calendário (interpretação híbrida). */
export interface CalendarParseResult {
  /**
   * Intenção reconhecida:
   *  - `create_event`: somente evento (compromisso independente).
   *  - `create_task_with_calendar`: somente tarefa + calendário derivado.
   *  - `create_task_and_event`: tarefa + evento independente adicionais.
   *  - `none`: não é nada de calendário (deixa o taskEngine decidir).
   */
  intent: 'create_event' | 'create_task_with_calendar' | 'create_task_and_event' | 'none';
  /** Confiança global 0..1. */
  confidence: number;
  /** Eventos identificados (0..N — ver seção 26 múltiplos eventos). */
  events: ParsedCalendarEvent[];
  /**
   * Instrução para calendarizar uma tarefa que já existe/reconheceu. Quando
   * preenchido, o chat decide chamar `calendarizeTask` no store.
   */
  taskCalendar?: ParsedTaskCalendarLink;
  /** Motivo humano quando `intent === 'none'`. */
  reason: string | null;
  /** Texto original. */
  originalText: string;
  /** Texto normalizado (mantém original intacto — ver taskEngine/normalize). */
  normalized: NormalizedText;
}

/** Nível de confiança (reutilizado do taskEngine para coerência). */
export type { ConfidenceLevel, NormalizedText } from '../taskEngine/types.ts';