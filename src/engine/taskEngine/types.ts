/**
 * Tipos do motor determinístico de interpretação de TAREFAS.
 *
 * Camada avançada que roda sobre linguagem natural livre, baseada em
 * COMPONENTES (intenção / ação / objeto / data / responsável / tag) em vez
 * de regex de frase completa. Orquestrada por `taskParser.ts` e consumida
 * pelo fluxo de chat (`app/(tabs)/chat.tsx`).
 *
 * O resultado não substitui o `ParsedMessage` do `regexEngine.ts` — é uma
 * estrutura rica complementar usada quando o dom é tarefa. O schema da
 * tarefa persistida (`Task` em `src/store/index.ts`) é preservado; este
 * tipo é o intermediário entre a mensagem e o `addTask`.
 */

/** Referência mínima a uma pessoa/funcionário disponível no contexto real. */
export interface PersonRef {
  id: string;
  name: string;
}

/** Contexto real do usuário injetado no parser (não inventa nada). */
export interface TaskParserContext {
  /** Data/hora atual do sistema — base para datas relativas. */
  now: Date;
  /** Pessoas disponíveis para atribuição (ex.: `employeeItems` do store). */
  people: PersonRef[];
  /** Tags de tarefa vindas do onboarding (`taskTags`) + custom (`customTaskTags`). */
  taskTags: string[];
  /** Palavra/expressão -> tag, do onboarding (`keywordMap`). */
  keywordMap: Record<string, string>;
  taxonomy?: GenericNode[];
}

/** Entidades brutas extraídas da mensagem (antes da resolução de contexto). */
export interface TaskEntity {
  /** Verbo canônico no infinitivo (ex.: "comprar", "ligar"). */
  action: string | null;
  /** Objeto da ação (ex.: "cimento", "orçamento da obra"). */
  object: string | null;
  /** Menção textual de pessoa (ex.: "João"). */
  personName: string | null;
  /** Expressão temporal crua (ex.: "amanhã", "sexta às 10"). */
  dateExpression: string | null;
  /** Horário cru (ex.: "10:00"). */
  timeExpression: string | null;
  /** True quando a data aparece como prazo ("até sexta"), não ponto ("sexta"). */
  isDeadline: boolean;
}

/** Nível de confiança do reconhecimento. */
export type ConfidenceLevel = 'alta' | 'media' | 'baixa';

/** Uma tarefa reconhecida, já resolvida contra o contexto real. */
export interface ParsedTask {
  /** Título útil para o usuário (ex.: "Comprar cimento"). */
  title: string;
  /** Contexto extra que não coube no título, quando houver. */
  description: string | null;
  /** ISO YYYY-MM-DD ou null. */
  dueDate: string | null;
  /** HH:MM ou null. */
  dueTime: string | null;
  /** Rótulo humano do prazo (ex.: "Amanhã", "Sexta"). */
  dueDateLabel: string | null;
  /** Id de pessoa resolvida no contexto, ou null se não houver match seguro. */
  assigneeId: string | null;
  /** Nome da pessoa resolvida, ou menção crua se não resolvida. */
  assigneeName: string | null;
  /** Tags resolvidas a partir de `taskTags`/`keywordMap`. */
  tags: string[];
  category?: string | null;
  categoryId?: string | null;
  subcategory?: string | null;
  subcategoryId?: string | null;
  subcategoryCandidates?: string[];
  /** Entidades brutas extraídas. */
  entities: TaskEntity;
  /** Confiança numérica 0..1. */
  confidence: number;
  /** Confiança em nível. */
  confidenceLevel: ConfidenceLevel;
  /** Texto original do usuário, preservado. */
  originalText: string;
}

/** Resultado completo do parser de tarefas. */
export interface TaskParseResult {
  /** Intenção reconhecida. `none` quando a mensagem não é tarefa. */
  intent: 'create_task' | 'none';
  /** Confiança global 0..1. */
  confidence: number;
  /** Tarefas reconhecidas (pode ser >1 — ver seção 7 da especificação). */
  tasks: ParsedTask[];
  /** Motivo humano quando `intent === 'none'` (ex.: negação, pergunta, passado). */
  reason: string | null;
  /** Texto original preservado. */
  originalText: string;
}

/** Mensagem normalizada, mantendo o original intacto (ver `normalize.ts`). */
export interface NormalizedText {
  original: string;
  /** lowercase, espaços normalizados, sem pontuação relevante, sem acentos? não — acentos preservados. */
  text: string;
  /** Tokens por espaço. */
  tokens: string[];
}
import type { GenericNode } from '../taxonomy/types.ts';
