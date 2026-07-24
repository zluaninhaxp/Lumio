import { OPEN_QUESTIONS } from '../data/onboardingQuestions';
import {
  guessBusinessNameFallback,
  guessBusinessTypeFallback,
  OpenOnboardingAnswers,
} from '../engine/openOnboardingEngine';

/**
 * Um par pergunta/resposta bruto, exatamente como o usuário respondeu.
 * Nada aqui é "interpretado" — essa é a matéria-prima que a IA vai analisar.
 */
export interface OnboardingQA {
  blockId: string;
  question: string;
  answer: string;
}

/**
 * DTO único com todos os dados coletados no onboarding, pronto para ser
 * serializado e enviado para a camada de IA (ver `aiOnboardingService.ts`).
 *
 * Esta estrutura é intencionalmente desacoplada de `app/onboarding.tsx`:
 * a tela não sabe (e não precisa saber) que este objeto existe além de
 * chamar `buildOnboardingContextDTO()` uma vez, ao final do fluxo.
 */
export interface OnboardingContextDTO {
  /** Data/hora em que o onboarding foi concluído (ISO 8601). */
  submittedAt: string;
  /** Heurística local (sem IA) — apenas um palpite inicial, não definitivo. */
  businessNameGuess: string;
  /** Heurística local (sem IA) — apenas um palpite inicial, não definitivo. */
  businessTypeGuess: string;
  /** Todas as perguntas e respostas do onboarding, na ordem em que ocorreram. */
  answers: OnboardingQA[];
}

/**
 * Monta o DTO a partir das respostas brutas do onboarding.
 * Não faz nenhuma chamada de rede — é uma função pura e síncrona.
 */
export function buildOnboardingContextDTO(
  answers: OpenOnboardingAnswers
): OnboardingContextDTO {
  const qa: OnboardingQA[] = OPEN_QUESTIONS
    .filter((block) => !!answers[block.id]?.trim())
    .map((block) => ({
      blockId: block.id,
      question: block.question,
      answer: answers[block.id].trim(),
    }));

  return {
    submittedAt: new Date().toISOString(),
    businessNameGuess: guessBusinessNameFallback(answers),
    businessTypeGuess: guessBusinessTypeFallback(answers),
    answers: qa,
  };
}
