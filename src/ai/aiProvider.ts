/**
 * Contrato da camada de provedor de IA usada pelo onboarding (ver
 * `aiOnboardingService.ts`). Hoje só existe a implementação Gemini (ver
 * `geminiProvider.ts`), mas a interface existe para isolar o fluxo do
 * onboarding de detalhes de transporte — trocar de modelo ou de versão do
 * Gemini não exige mexer em mais nada além de `geminiProvider.ts`.
 *
 * É também o ponto onde a política BYOK do projeto é enforceada em tipo:
 * nenhum método aqui recebe chave — quem implementa o provedor é responsável
 * por ler a chave do usuário (ver `services/secureKeyStorage.ts`). NENHUMA
 * chave de desenvolvedor fica embutida no app (ver relatório final).
 */
export interface AIProvider {
  /** Identificador estável do provedor (ex.: 'gemini'). */
  readonly id: string;
  /** Nome amigável para mensagens de UI (ex.: 'Google Gemini'). */
  readonly label: string;

  /**
   * Envia o prompt ao modelo e devolve o texto bruto retornado por ele.
   * A responsabilidade de fazer o parsing estruturado é de quem chama (ver
   * `aiOnboardingService.ts`) — este método só entrega o texto cru, já
   * limpo de cercas markdown extras quando o provedor consegue garantir
   * JSON (mas mantenha o parsing defensivo do lado de quem consome).
   *
   * Erros são sempre lançados como `AIProviderError` (ou uma subclasse
   * específica, como `MissingApiKeyError`) — nunca strings soltas.
   */
  generate(prompt: string): Promise<string>;

  /**
   * Faz uma chamada mínima e barata só para validar que a chave do
   * usuário funciona. Resolve `void` em sucesso, lança `AIProviderError`
   * em falha. Usado pela tela de configurações (botão "Testar chave").
   */
  testKey(): Promise<void>;
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
  /** Validação local do DTO de entrada falhou (sem chamada à rede). */
  | 'invalid-input';

const AI_ERROR_DEFAULT_MESSAGES: Record<AIErrorKind, string> = {
  'missing-api-key': 'Você ainda não configurou sua chave de IA.',
  unauthorized: 'Sua chave de IA foi recusada. Confira se ela está correta e ativa.',
  'quota-exceeded':
    'O limite gratuito da sua conta Google foi atingido por enquanto. ' +
    'Tente novamente mais tarde ou aguarde a renovação da cota.',
  'payment-required': 'O plano da sua chave de IA exige pagamento para esta chamada.',
  network: 'Sem conexão com a IA. Verifique sua internet e tente novamente.',
  'bad-format': 'A IA respondeu em um formato inesperado. Tente gerar novamente.',
  provider: 'A IA retornou um erro. Tente novamente em instantes.',
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