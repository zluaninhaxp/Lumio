/**
 * Mapeamento central das expressões do mascote usadas no onboarding.
 *
 * Cada bloco de pergunta (ver `onboardingQuestions.ts`) ganha uma expressão
 * "principal" (quando faz a pergunta) e o fluxo usa algumas expressões
 * compartilhadas para estados de interação (pensando, ouvindo, pedindo mais
 * detalhes, resumo final). Isso mantém a lógica de perguntas 100% intacta —
 * este arquivo só decora o que já existe com uma imagem.
 */

export const MASCOT_IMAGES = {
  neutro: require('../../assets/mascot-expressions/01_neutro.png'),
  feliz: require('../../assets/mascot-expressions/02_feliz.png'),
  serio: require('../../assets/mascot-expressions/03_serio.png'),
  confuso: require('../../assets/mascot-expressions/04_confuso.png'),
  muitoFeliz: require('../../assets/mascot-expressions/05_muito_feliz.png'),
  triste: require('../../assets/mascot-expressions/06_triste.png'),
  piscando: require('../../assets/mascot-expressions/10_piscando.png'),
  sorrisoLeve: require('../../assets/mascot-expressions/11_sorriso_leve.png'),
  focado: require('../../assets/mascot-expressions/12_focado.png'),
  calmo: require('../../assets/mascot-expressions/13_calmo.png'),
  satisfeito: require('../../assets/mascot-expressions/15_satisfeito.png'),
  semBoca: require('../../assets/mascot-expressions/20_sem_boca.png'),
} as const;

export type MascotExpressionKey = keyof typeof MASCOT_IMAGES;

/** Expressão principal usada quando o mascote faz a pergunta de cada bloco. */
export const BLOCK_MASCOT_EXPRESSION: Record<string, MascotExpressionKey> = {
  visaoGeral: 'feliz',
  rotina: 'focado',
  equipe: 'sorrisoLeve',
  financas: 'calmo',
  clientes: 'satisfeito',
  dores: 'triste',
  sazonalidade: 'serio',
  objetivos: 'muitoFeliz',
  complemento: 'sorrisoLeve',
};

/** Expressão usada na transição/abertura de cada etapa (stage 1-4). */
export const STAGE_INTRO_MASCOT: Record<number, MascotExpressionKey> = {
  1: 'feliz',
  2: 'sorrisoLeve',
  3: 'calmo',
  4: 'muitoFeliz',
};

/** Estados compartilhados de interação, independente do bloco atual. */
export const INTERACTION_MASCOT: Record<
  'thinking' | 'listening' | 'followUp' | 'summary',
  MascotExpressionKey
> = {
  thinking: 'piscando',
  listening: 'semBoca',
  followUp: 'confuso',
  summary: 'muitoFeliz',
};
