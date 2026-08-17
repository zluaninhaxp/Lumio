/**
 * Espelha exatamente o SCHEMA DE SAÍDA definido em `extractionPrompt.ts`.
 * Se o schema do prompt mudar, atualize este tipo junto.
 *
 * Este tipo é o contrato entre o onboarding e os 3 módulos existentes do
 * app (Financeiro, Tarefas, Calendário): tanto a heurística mock local
 * (ver `openOnboardingEngine.ts` -> `buildMockExtractionResult`) quanto a
 * futura chamada real de IA (ver `aiOnboardingService.ts`) devolvem
 * exatamente este formato.
 */
export interface OnboardingExtractionResult {
  businessName: string | null;
  segment: string | null;

  /**
   * Resumo geral, em 2-4 frases corridas, do que o usuário contou e do que
   * foi entendido sobre o negócio — usado na tela de resumo pós-onboarding
   * no lugar de exibir cada pergunta/resposta individualmente.
   */
  summary: string;

  coreCategories: {
    financial: {
      expense: CategorySuggestion[];
      income: CategorySuggestion[];
    };
    taskTags: CategorySuggestion[];
    calendarEventTypes: CategorySuggestion[];
  };

  /**
   * Palavra/expressão -> nome de uma categoria já presente em
   * `coreCategories.financial` ou `coreCategories.taskTags`. Usado para
   * auto-sugerir a categoria de um lançamento/tarefa que o usuário digitar.
   */
  keywordMap: Record<string, string>;

  /**
   * Módulos adicionais (fora dos 3 fixos) que fazem sentido para este
   * negócio. Apenas sugestão — nenhum é ativado automaticamente.
   */
  recommendedPlugins: RecommendedPlugin[];

  missingInformation: string[];
}

export interface RecommendedPlugin {
  /** Id do plugin — ver lista fechada a ser definida no Prompt 2. */
  plugin: string;
  /**
   * Justificativa humana de POR QUE este plugin faz sentido para ESTE
   * usuário (ex: "Você mencionou que revende produtos com giro rápido").
   *
   * NÃO é a descrição oficial do plugin — a descrição de cada plugin já
   * existe previamente no catálogo em `src/plugins/registry.ts` e é
   * sempre exibida de forma idêntica pelo app (a partir de
   * `PluginDefinition.description`), independentemente das respostas do
   * usuário. A IA não deve gerar, resumir ou adaptar essa descrição em
   * hipótese alguma; `reason` serve apenas para explicar a recomendação
   * para aquele usuário, separada da descrição oficial.
   */
  reason: string;
  confidence: 'alta' | 'media' | 'baixa';
}

/**
 * REGRAS DE NEGÓCIO IMPORTANTES (documentadas aqui por serem centrais ao
 * schema, não apenas detalhe de implementação):
 *
 * - `origin: 'mentioned'` = o usuário citou isso literalmente ou de forma
 *   muito próxima na resposta do onboarding.
 * - `origin: 'suggested'` = a IA (ou a heurística mock) inferiu com base no
 *   segmento do negócio, mesmo sem o usuário ter citado.
 * - Itens `suggested` chegam PRÉ-ATIVADOS na configuração inicial dos
 *   módulos, mas devem permanecer marcados internamente como sugestão —
 *   no futuro (fora do escopo desta tarefa) o app poderá sugerir remover
 *   categorias `suggested` nunca usadas depois de um tempo. Essa remoção
 *   NÃO está implementada agora; o único requisito atual é preservar o
 *   campo `origin` em qualquer lugar onde esses dados forem armazenados
 *   (ver `AppStore` em `src/store/index.ts`).
 */
export interface CategorySuggestion {
  label: string;
  origin: 'mentioned' | 'suggested';
}
