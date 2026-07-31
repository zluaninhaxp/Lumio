import { OPEN_QUESTIONS } from '../data/onboardingQuestions';
import { guessBusinessType, BUSINESS_PROFILES, BusinessTypeKey } from '../data/onboardingProfiles';
import { OnboardingExtractionResult, CategorySuggestion } from '../ai/types';

export { OPEN_QUESTIONS };
export type { OpenQuestionBlock } from '../data/onboardingQuestions';

export type OpenOnboardingAnswers = Record<string, string>;

/**
 * Fallback temporário: heurística de keywords para dar um nome de segmento
 * na tela final, rodando apenas sobre a resposta do bloco 1 (negocio).
 *
 * ⚠️ TODO — Esta função inteira será substituída pela chamada real ao
 * prompt de extração (ver documento "Prompt de extração") assim que a
 * integração com IA for implementada.
 */
export function guessBusinessTypeFallback(answers: OpenOnboardingAnswers): string {
  const firstAnswer = answers.negocio ?? '';
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
  const firstAnswer = answers.negocio ?? '';

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

function includesLoose(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/** Marca cada label como 'mentioned' se aparecer (mesmo que parcialmente) no texto do usuário, senão 'suggested'. */
function toSuggestions(labels: string[], userText: string): CategorySuggestion[] {
  return labels.map((label) => ({
    label,
    origin: includesLoose(userText, label) ? 'mentioned' : 'suggested',
  }));
}

/**
 * Heurística mock local (sem IA): produz um `OnboardingExtractionResult`
 * plausível a partir APENAS da resposta do bloco 1 (negócio e segmento),
 * usando as tabelas fixas por segmento de `onboardingProfiles.ts`.
 *
 * ⚠️ PLACEHOLDER DE DEMONSTRAÇÃO — esta função existe só para a tela final
 * do onboarding poder ser testada/exibida sem depender de nenhuma API. Ela
 * será substituída pela chamada real ao modelo de IA usando o prompt de
 * `src/ai/extractionPrompt.ts` (ver `src/ai/aiOnboardingService.ts`). A
 * função de integração real já recebe e devolve exatamente o mesmo tipo
 * `OnboardingExtractionResult` usado aqui, então trocar a implementação não
 * deve exigir mudanças nas telas ou no store.
 */
export function buildMockExtractionResult(answers: OpenOnboardingAnswers): OnboardingExtractionResult {
  const businessAnswer = answers.negocio ?? '';
  const segmentKey: BusinessTypeKey | null = guessBusinessType(businessAnswer);
  const profile = BUSINESS_PROFILES[segmentKey ?? 'outro'];

  const businessName = segmentKey ? guessBusinessNameFallback(answers) : null;
  const segment = segmentKey ? profile.label : null;

  const expense = toSuggestions(profile.financialCategories, businessAnswer);
  const income = toSuggestions(profile.incomeCategories, businessAnswer);
  const taskTags = toSuggestions(profile.taskTags, answers.tarefas ?? businessAnswer);
  const calendarEventTypes = toSuggestions(profile.calendarEventTypes, answers.compromissos ?? businessAnswer);

  const keywordMap: Record<string, string> = {};
  profile.keywords.forEach((kw) => {
    keywordMap[kw] = profile.financialCategories[0] ?? profile.label;
  });
  Object.entries(profile.keywordAdditions).forEach(([word, label]) => {
    keywordMap[word] = label;
  });

  const missingInformation: string[] = [];
  if (!businessName) missingInformation.push('businessName');
  if (!segment) missingInformation.push('segment');

  return {
    businessName,
    segment,
    coreCategories: {
      financial: { expense, income },
      taskTags,
      calendarEventTypes,
    },
    keywordMap,
    recommendedPlugins: profile.recommendedPlugins,
    missingInformation,
  };
}
