import { OnboardingContextDTO } from './onboardingContext';
import { buildExtractionPrompt } from './extractionPrompt';
import { OnboardingExtractionResult } from './types';

/**
 * Camada de integração futura com IA.
 *
 * NADA nesta função faz uma chamada de rede hoje. Ela existe para que o
 * restante do app (store, telas) já possa depender de uma interface estável
 * — `Promise<OnboardingExtractionResult>` — sem precisar ser alterado quando
 * a IA for de fato conectada. Hoje quem produz esse mesmo tipo é a
 * heurística mock local (ver `openOnboardingEngine.ts` ->
 * `buildMockExtractionResult`), usada pela tela de onboarding.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ COMO ESTA FUNÇÃO SERÁ IMPLEMENTADA QUANDO A IA FOR INTEGRADA:        │
 * │                                                                      │
 * │ 1. NÃO chame a API do modelo de IA diretamente a partir do app       │
 * │    (React Native). Isso exigiria embutir uma chave de API no         │
 * │    cliente, o que não é seguro. Chame um endpoint do seu backend.    │
 * │                                                                      │
 * │ 2. O backend recebe o `OnboardingContextDTO` (ou o prompt já         │
 * │    montado, via `buildExtractionPrompt(dto)`) e faz a chamada real   │
 * │    ao modelo de IA, usando esse texto como prompt.                   │
 * │                                                                      │
 * │ 3. O backend deve validar que a resposta do modelo é um JSON válido  │
 * │    no formato `OnboardingExtractionResult` antes de devolver ao app. │
 * │                                                                      │
 * │ Exemplo de como o corpo desta função ficará:                        │
 * │                                                                      │
 * │   const response = await fetch(`${API_BASE_URL}/onboarding/extract`, │
 * │     {                                                                │
 * │       method: 'POST',                                               │
 * │       headers: { 'Content-Type': 'application/json' },              │
 * │       body: JSON.stringify({ dto }),                                │
 * │     }                                                                │
 * │   );                                                                 │
 * │   if (!response.ok) throw new Error('Falha ao processar onboarding');│
 * │   return (await response.json()) as OnboardingExtractionResult;      │
 * └─────────────────────────────────────────────────────────────────────┘
 */
export async function extractBusinessProfile(
  dto: OnboardingContextDTO
): Promise<OnboardingExtractionResult> {
  // Mantido aqui só para deixar claro, em tempo de desenvolvimento, qual
  // seria o conteúdo exato enviado ao modelo quando a integração existir.
  // eslint-disable-next-line no-console
  console.log('[extractBusinessProfile] prompt que seria enviado à IA:\n', buildExtractionPrompt(dto));

  throw new Error(
    'extractBusinessProfile ainda não está implementado — a integração com IA ' +
    'será feita em uma etapa futura. Ver comentário deste arquivo para o plano exato.'
  );
}
