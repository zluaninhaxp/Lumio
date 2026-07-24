import { OPEN_QUESTIONS } from '../data/onboardingQuestions';
import { guessBusinessType, BUSINESS_PROFILES } from '../data/onboardingProfiles';

export { OPEN_QUESTIONS };
export type { OpenQuestionBlock } from '../data/onboardingQuestions';

export type OpenOnboardingAnswers = Record<string, string>;

/**
 * Fallback temporário: heurística de keywords para dar um nome de segmento
 * na tela final, rodando apenas sobre a resposta do bloco 1 (visaoGeral).
 *
 * ⚠️ TODO — Esta função inteira será substituída pela chamada real ao
 * prompt de extração (ver documento "Prompt de extração") assim que a
 * integração com IA for implementada.
 */
export function guessBusinessTypeFallback(answers: OpenOnboardingAnswers): string {
  const firstAnswer = answers.visaoGeral ?? '';
  const guessed = guessBusinessType(firstAnswer);
  if (guessed) {
    return BUSINESS_PROFILES[guessed].label;
  }
  return 'Negócio';
}

/**
 * Tenta extrair um nome de negócio curto a partir da resposta do bloco 1.
 * Primeiro procura por padrões explícitos ("chamado X", "chamada X",
 * "chama-se X"), que tendem a isolar melhor o nome próprio do que apenas
 * cortar no primeiro sinal de pontuação. Se nada for encontrado, cai para a
 * heurística antiga (texto antes da primeira vírgula/travessão).
 * Também será substituída pelo prompt de extração com IA.
 */
export function guessBusinessNameFallback(answers: OpenOnboardingAnswers): string {
  const firstAnswer = answers.visaoGeral ?? '';

  const namedPattern = /cham[ao](?:-se)?\s+([A-ZÀ-Ú][\p{L}0-9'-]*(?:\s+[A-ZÀ-Ú0-9][\p{L}0-9'-]*){0,3})/u;
  const match = firstAnswer.match(namedPattern);
  if (match?.[1]) {
    return match[1].trim();
  }

  const firstPart = firstAnswer.split(/[,—–-]/)[0]?.trim() ?? '';
  if (firstPart.length >= 3 && firstPart.length <= 80) {
    return firstPart;
  }
  return 'Sua empresa';
}
