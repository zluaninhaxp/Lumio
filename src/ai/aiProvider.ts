/**
 * Contrato da camada de provedor de IA usada pelo onboarding (ver
 * `aiOnboardingService.ts`). Hoje só existe a implementação Gemini (ver
 * `geminiProvider.ts`), mas a interface existe para isolar o fluxo do
 * onboarding de detalhes de transporte. Modelo e configuração do Gemini
 * ficam exclusivamente na Edge Function autenticada.
 *
 * Nenhum método recebe chave. A Edge Function autentica o usuário e acessa
 * a chave pessoal criptografada no servidor.
 */
import type { OnboardingContextDTO } from './onboardingContext';

export interface AIProvider {
  /** Identificador estável do provedor (ex.: 'gemini'). */
  readonly id: string;
  /** Nome amigável para mensagens de UI (ex.: 'Google Gemini'). */
  readonly label: string;

  /**
   * Envia respostas ao backend, que monta o prompt e valida o resultado.
   * A responsabilidade de fazer o parsing estruturado é de quem chama (ver
   * `aiOnboardingService.ts`) — este método só entrega o texto cru, já
   * limpo de cercas markdown extras quando o provedor consegue garantir
   * JSON (mas mantenha o parsing defensivo do lado de quem consome).
   *
   * Erros são sempre lançados como `AIProviderError` (ou uma subclasse
   * específica, como `MissingApiKeyError`) — nunca strings soltas.
   */
  generate(context: OnboardingContextDTO): Promise<string>;

}

/**
 * Categorias discriminadas de erro que a UI consegue tratar de forma
 * específica (ver `celebration.tsx` e `ai-settings.tsx`).
 */
export type AIErrorKind =
  /** Usuário ainda não cadastrou nenhuma chave de API. */
  | 'missing-api-key'
  /** Chave recusada pelo provedor (401/403 ou equivalente do Gemini). */
  | 'unauthorized'
  /** Limite da cota do plano gratuito do próprio usuário estourado (429). */
  | 'quota-exceeded'
  /** Créditos/pagamento esgotados no plano do usuário (402). */
  | 'payment-required'
  /** Falha de rede / timeout. */
  | 'network'
  /** Resposta veio, mas não bate com o schema esperado / JSON inválido. */
  | 'bad-format'
  /** Erro inesperado do provedor (5xx, etc.) não classificado acima. */
  | 'provider'
  | 'provider-request'
  | 'provider-model'
  /** Validação local do DTO de entrada falhou (sem chamada à rede). */
  | 'invalid-input'
  | 'not-authenticated'
  | 'status-unavailable'
  | 'backend'
  | 'timeout';

const AI_ERROR_DEFAULT_MESSAGES: Record<AIErrorKind, string> = {
  'not-authenticated': 'Sua sessão terminou ou mudou. Entre novamente na sua conta.',
  'status-unavailable': 'Não foi possível consultar a configuração de IA. Tente novamente.',
  backend: 'O serviço de IA está indisponível. Tente novamente.',
  timeout: 'A IA demorou para responder. Tente novamente.',
  'missing-api-key': 'Você ainda não configurou sua chave de IA.',
  unauthorized: 'Sua chave de IA foi recusada. Confira se ela está correta e ativa.',
  'quota-exceeded':
    'O limite gratuito da sua conta Google foi atingido por enquanto. ' +
    'Tente novamente mais tarde ou aguarde a renovação da cota.',
  'payment-required': 'O plano da sua chave de IA exige pagamento para esta chamada.',
  network: 'Sem conexão com a IA. Verifique sua internet e tente novamente.',
  'bad-format': 'A IA respondeu em um formato inesperado. Tente gerar novamente.',
  provider: 'A IA retornou um erro. Tente novamente em instantes.',
  'provider-request': 'O Lumio enviou uma solicitação que o Gemini não aceitou. Tente novamente mais tarde.',
  'provider-model': 'O modelo de IA não está disponível para esta chave. Confira o projeto no Google AI Studio.',
  'invalid-input': 'Não foi possível montar o pedido para a IA a partir das suas respostas.',
};

/**
 * Erro "de domínio" da camada de IA. As telas podem confiar em `error.kind`
 * para decidir qual ação oferecer (ex.: botão "Ir para configurações" só
 * faz sentido para `missing-api-key` e `unauthorized`), e em `error.message`
 * para exibir texto já traduzido e amigável. O `cause` cru da API NUNCA é
 * exposto ao usuário — fica só aqui para debug interno.
 */
export class AIProviderError extends Error {
  readonly kind: AIErrorKind;
  readonly cause?: unknown;

  constructor(kind: AIErrorKind, message?: string, cause?: unknown) {
    super(message ?? AI_ERROR_DEFAULT_MESSAGES[kind]);
    this.name = 'AIProviderError';
    this.kind = kind;
    this.cause = cause;
  }
}

/**
 * Especialização tipada para "nenhuma chave cadastrada" — a tela de
 * celebração precisa diferenciar este caso para oferecer o caminho
 * (a) do fallback de simulação (ver instruções da tarefa, item 3.2).
 */
export class MissingApiKeyError extends AIProviderError {
  constructor(cause?: unknown) {
    super('missing-api-key', undefined, cause);
    this.name = 'MissingApiKeyError';
  }
}
