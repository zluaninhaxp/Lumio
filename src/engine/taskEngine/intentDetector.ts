/**
 * Detecção de INTENÇÃO para o domínio de tarefas.
 *
 * Decide entre `create_task` e `none`, atribuindo confiança. Considera:
 *  - gatilhos explícitos/implícitos (necessidade, comando, lembrete,
 *    planejamento, compromisso, narrativa, solicitação indireta);
 *  - presença de ação recognoscível;
 *  - filtros de NEGÔÇÃO, PASSADO (ação realizada) e PERGUNTA;
 *  - insuficiência de informação (mensagem muito curta sem ação).
 *
 * A confiança é o que decide (na integração) se a tarefa é criada
 * automaticamente ou se cai para fallback/IA (ver seções 16/17).
 */
import { INTENT_TRIGGERS, NEGATION_MARKERS, PAST_DONE_MARKERS, QUESTION_MARKERS, resolveAction } from './dictionaries.ts';
import type { NormalizedText } from './types.ts';

export interface IntentAssessment {
  intent: 'create_task' | 'none';
  confidence: number;
  level: 'alta' | 'media' | 'baixa';
  /** Sinais que puxaram a confiança (para debug/futura UI). */
  evidence: string[];
  /** Motivo humano quando `intent === 'none'`. */
  reason: string | null;
  /** True se uma ação recognoscível está presente. */
  hasAction: boolean;
  /** Ação canônica detectada (primeira). */
  action: string | null;
}

/**
 * Avalia a intenção de TAREFA. Recebe a mensagem normalizada.
 */
export function assessIntent(n: NormalizedText): IntentAssessment {
  const text = n.text;
  const evidence: string[] = [];
  let score = 0;

  if (!text) return none('Mensagem vazia.');

  // --- Filtro: negação forte "não preciso", "não quero", "deixa pra lá" ---
  const negHit = firstMatch(text, NEGATION_MARKERS);
  if (negHit !== null) {
    return none(`Detectado marcador de negação: "${negHit}".`);
  }

  // --- Filtro: pergunta ---
  const qHit = firstMatch(text, QUESTION_MARKERS);
  // Detecção precisa de pergunta: só casa frases inequívocas (com boundary)
  // ou a presença do sinal "?". Evita falsos positivos como "tenh**o que**".
  const QUESTION_PHRASES = [
    'quanto custa', 'quanto fica', 'quanto é ', 'quanto eh ',
    'onde compro', 'aonde compro', 'onde fica',
    'você acha que', 'voce acha que', 'vc acha que', 'vocês acham',
    'devo comprar', 'devo fazer', 'devo pagar',
    'será que ', 'sera que ',
    'como faço', 'como eu faço', 'o que eu faço', 'o que devo',
  ];
  const hasQuestionPhrase = QUESTION_PHRASES.some((p) => text.includes(p));
  const hasQuestionMark = /\?/.test(text);
  if (qHit !== null || hasQuestionPhrase || hasQuestionMark) {
    // Perguntas puras não geram tarefa — exceto gatilhos fortes de lembrete
    // ("me lembra de comprar?").
    if (!/(me lembra|me lembre|anota|não esquece|nao esquece)/.test(text)) {
      return none(`Parece uma pergunta${qHit ? ` ("${qHit}")` : ''}.`);
    }
  }

  // --- Filtro: ação já realizada (passado) ---
  const pastHit = firstMatch(text, PAST_DONE_MARKERS);
  if (pastHit !== null) {
    // "ontem/anteontem" sozinho não descarta, mas junto com verbo no passado sim.
    const isPastOnly = pastHit === 'ontem' || pastHit === 'anteontem';
    if (!isPastOnly || /(já|ja)\s/.test(text)) {
      return none(`Indica ação já realizada: "${pastHit}".`);
    }
    // passado puramente temporal baixa confiança
    score -= 0.2;
    evidence.push(`referência temporal passada (${pastHit})`);
  }

  // --- Sinais positivos ---
  // Gatilhos explícitos/implícitos de intenção
  let triggerHits = 0;
  for (const trg of INTENT_TRIGGERS) {
    if (text.includes(trg)) { triggerHits++; evidence.push(`gatilho: "${trg}"`); }
  }
  // Verbo de ação recognoscível
  let action: string | null = null;
  for (const tok of n.tokens) {
    const a = resolveAction(tok);
    if (a) { action = a; evidence.push(`ação: ${a}`); break; }
  }
  // tenta também casar verbo composto no texto (ex.: "entrar em contato")
  if (!action) {
    for (const phrase of ['entrar em contato', 'mandar mensagem', 'dar retorno', 'fazer orçamento', 'fazer orcamento', 'fazer cotação', 'fazer cotacao', 'deixar pronto']) {
      if (text.includes(phrase)) {
        action = actionForPhrase(phrase);
        evidence.push(`ação compost: ${action}`);
        break;
      }
    }
  }

  const hasAction = action !== null;

  // Pontuação base
  if (triggerHits > 0) score += 0.45 + Math.min(triggerHits * 0.05, 0.15);
  if (hasAction) score += 0.4;
  // Objeto: se há substantivo extra além da ação/data/pessoa (heurística: > 2 tokens restantes)
  const meaningfulTokens = n.tokens.filter((t) => t.length > 2);
  if (hasAction && meaningfulTokens.length >= 2) score += 0.1;

  // Insuficiência: mensagem muito curta sem gatilho nem ação
  if (!hasAction && triggerHits === 0) {
    return none('Sem gatilho de intenção e sem ação recognoscível.');
  }
  // Muito curta com ação mas sem objeto (ex.: "comprar", "ligar")
  if (hasAction && meaningfulTokens.length < 2 && triggerHits === 0) {
    // ainda pode ser tarefa ("ligar pro João" etc.) — deixa o extrator decidir;
    // aqui só baixamos confiança
    score -= 0.15;
  }

  // Apenas um gatilho genérico sem ação ("adiciona", "cria uma tarefa")
  if (triggerHits > 0 && !hasAction && meaningfulTokens.length < 2) {
    return none('Gatilho explícito sem ação/objeto suficiente.');
  }

  score = clamp01(score);

  // Decisão por nível
  const level: 'alta' | 'media' | 'baixa' = score >= 0.75 ? 'alta' : score >= 0.5 ? 'media' : 'baixa';

  // Se pontuação muito baixa, tratamos como não-tarefa
  if (score < 0.4) {
    return { intent: 'none', confidence: score, level: 'baixa', evidence, reason: 'Confiança insuficiente para criar tarefa automaticamente.', hasAction, action };
  }

  return { intent: 'create_task', confidence: round(score), level, evidence, reason: null, hasAction, action };
}

function none(reason: string): IntentAssessment {
  return { intent: 'none', confidence: 0, level: 'baixa', evidence: [], reason, hasAction: false, action: null };
}

function firstMatch(text: string, list: string[]): string | null {
  for (const item of list) {
    if (text.includes(item)) return item;
  }
  return null;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function round(x: number): number {
  return Math.round(x * 100) / 100;
}

function actionForPhrase(phrase: string): string {
  switch (phrase) {
    case 'entrar em contato': return 'falar';
    case 'mandar mensagem': return 'enviar';
    case 'dar retorno': return 'responder';
    case 'fazer orçamento':
    case 'fazer orcamento': return 'orcar';
    case 'fazer cotação':
    case 'fazer cotacao': return 'cotar';
    case 'deixar pronto': return 'preparar';
    default: return 'fazer';
  }
}