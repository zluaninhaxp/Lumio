// Perfis de negócio para o onboarding (mock).
// Cada perfil define os módulos/categorias padrão sugeridos para aquele ramo.
// Quando a IA existir, esses perfis podem virar apenas um "fallback" e a
// origem real passa a ser o modelo de linguagem — a interface não muda.

export type BusinessTypeKey =
  | 'mercado'
  | 'restaurante'
  | 'vestuario'
  | 'oficina'
  | 'salao'
  | 'clinica'
  | 'servicos'
  | 'distribuidora'
  | 'ecommerce'
  | 'escritorio'
  | 'outro';

export interface BusinessProfile {
  key: BusinessTypeKey;
  label: string;
  icon: string; // nome do ícone Ionicons
  description: string;
  // Palavras-chave usadas pelo "motor de análise" mock para sugerir o tipo
  // a partir do texto livre digitado pelo usuário.
  keywords: string[];
  // Valores-padrão (podem ser sobrescritos pelas respostas do usuário)
  defaults: {
    sellsProducts: boolean;
    providesServices: boolean;
    hasStock: boolean;
    hasSuppliers: boolean;
    hasAppointments: boolean;
    hasQuotes: boolean;
  };
  productCategories: string[];
  financialCategories: string[];
  supplierCategories: string[];

  // --- Campos usados pela heurística mock de extração do onboarding ---
  // (ver `buildMockExtractionResult` em `src/engine/openOnboardingEngine.ts`
  // e o schema `OnboardingExtractionResult` em `src/ai/types.ts`)

  /** Categorias de receita plausíveis para o segmento. */
  incomeCategories: string[];
  /** Tags de tarefa plausíveis para o segmento. */
  taskTags: string[];
  /** Tipos de evento de calendário plausíveis para o segmento. */
  calendarEventTypes: string[];
  /**
   * Palavra/expressão -> nome de categoria (deve bater com um label presente
   * em `financialCategories`, `incomeCategories` ou `taskTags`), usada para
   * enriquecer o `keywordMap` além das palavras-chave de reconhecimento de
   * segmento (`keywords`).
   */
  keywordAdditions: Record<string, string>;
  /** Plugins fora dos 3 módulos fixos que fazem sentido para este segmento. */
  recommendedPlugins: {
    plugin: string;
    reason: string;
    confidence: 'alta' | 'media' | 'baixa';
  }[];
}

export const BUSINESS_PROFILES: Record<BusinessTypeKey, BusinessProfile> = {
  mercado: {
    key: 'mercado',
    label: 'Mercado / Mercearia',
    icon: 'cart',
    description: 'Venda de produtos variados no varejo',
    keywords: ['mercado', 'mercearia', 'supermercado', 'quitanda', 'padaria', 'minimercado', 'armazém'],
    defaults: {
      sellsProducts: true,
      providesServices: false,
      hasStock: true,
      hasSuppliers: true,
      hasAppointments: false,
      hasQuotes: false,
    },
    productCategories: ['Padaria', 'Açougue', 'Hortifruti', 'Bebidas', 'Limpeza', 'Higiene', 'Mercearia'],
    financialCategories: ['Compras', 'Energia', 'Água', 'Salários', 'Impostos', 'Aluguel'],
    supplierCategories: ['Distribuidoras', 'Hortifruti', 'Açougue', 'Bebidas'],
    incomeCategories: ['Vendas no balcão', 'Vendas por delivery/app'],
    taskTags: ['Reposição de estoque', 'Validade de produtos', 'Contato com fornecedor', 'Limpeza e organização'],
    calendarEventTypes: ['Entrega de fornecedor', 'Inventário/balanço', 'Pagamento de fornecedor'],
    keywordAdditions: {
      'estoque': 'Reposição de estoque',
      'validade': 'Validade de produtos',
      'fornecedor': 'Contato com fornecedor',
      'caixa': 'Vendas no balcão',
      'entrega': 'Entrega de fornecedor',
    },
    recommendedPlugins: [
      { plugin: 'estoque', reason: 'Você tem produtos com validade e giro rápido de estoque', confidence: 'alta' },
      { plugin: 'comissoes', reason: 'Negócios de varejo costumam ter funcionários com comissão sobre vendas', confidence: 'baixa' },
    ],
  },
  restaurante: {
    key: 'restaurante',
    label: 'Restaurante / Alimentação',
    icon: 'restaurant',
    description: 'Preparo e venda de refeições',
    keywords: ['restaurante', 'lanchonete', 'pizzaria', 'hamburgueria', 'bar', 'cafeteria', 'food truck', 'comida'],
    defaults: {
      sellsProducts: true,
      providesServices: false,
      hasStock: true,
      hasSuppliers: true,
      hasAppointments: false,
      hasQuotes: false,
    },
    productCategories: ['Entradas', 'Pratos principais', 'Bebidas', 'Sobremesas', 'Combos'],
    financialCategories: ['Ingredientes', 'Delivery', 'Funcionários', 'Aluguel', 'Energia', 'Gás'],
    supplierCategories: ['Hortifruti', 'Açougue', 'Bebidas', 'Embalagens'],
    incomeCategories: ['Vendas no salão', 'Vendas por delivery/app'],
    taskTags: ['Compra de ingredientes', 'Reposição de estoque', 'Limpeza da cozinha', 'Contato com fornecedor'],
    calendarEventTypes: ['Entrega de fornecedor', 'Reserva de mesa', 'Pagamento de fornecedor'],
    keywordAdditions: {
      'ingrediente': 'Compra de ingredientes',
      'delivery': 'Vendas por delivery/app',
      'reserva': 'Reserva de mesa',
      'fornecedor': 'Contato com fornecedor',
    },
    recommendedPlugins: [
      { plugin: 'estoque', reason: 'Você trabalha com ingredientes perecíveis e giro rápido', confidence: 'alta' },
      { plugin: 'comissoes', reason: 'Restaurantes costumam ter garçons com comissão/gorjeta', confidence: 'media' },
    ],
  },
  vestuario: {
    key: 'vestuario',
    label: 'Loja de roupas / Vestuário',
    icon: 'shirt',
    description: 'Venda de roupas, calçados e acessórios',
    keywords: ['roupa', 'vestuário', 'moda', 'loja de roupa', 'boutique', 'calçado', 'confecção'],
    defaults: {
      sellsProducts: true,
      providesServices: false,
      hasStock: true,
      hasSuppliers: true,
      hasAppointments: false,
      hasQuotes: false,
    },
    productCategories: ['Masculino', 'Feminino', 'Infantil', 'Calçados', 'Acessórios'],
    financialCategories: ['Compras', 'Aluguel', 'Salários', 'Marketing', 'Impostos'],
    supplierCategories: ['Confecções', 'Distribuidoras', 'Calçados'],
    incomeCategories: ['Vendas na loja', 'Vendas online'],
    taskTags: ['Reposição de estoque', 'Troca/devolução de cliente', 'Organização de vitrine', 'Contato com fornecedor'],
    calendarEventTypes: ['Entrega de fornecedor', 'Lançamento de coleção', 'Balanço de estoque'],
    keywordAdditions: {
      'estoque': 'Reposição de estoque',
      'troca': 'Troca/devolução de cliente',
      'vitrine': 'Organização de vitrine',
      'coleção': 'Lançamento de coleção',
    },
    recommendedPlugins: [
      { plugin: 'estoque', reason: 'Lojas de roupa costumam controlar tamanhos e grades de estoque', confidence: 'alta' },
      { plugin: 'comissoes', reason: 'Vendedores de loja costumam trabalhar com comissão sobre vendas', confidence: 'media' },
    ],
  },
  oficina: {
    key: 'oficina',
    label: 'Oficina',
    icon: 'construct',
    description: 'Manutenção e reparo (veículos, eletrônicos, etc.)',
    keywords: ['oficina', 'mecânic', 'conserto', 'reparo', 'auto elétric', 'funilaria'],
    defaults: {
      sellsProducts: true,
      providesServices: true,
      hasStock: true,
      hasSuppliers: true,
      hasAppointments: true,
      hasQuotes: true,
    },
    productCategories: ['Peças', 'Óleos e fluidos', 'Pneus', 'Acessórios'],
    financialCategories: ['Peças', 'Aluguel', 'Salários', 'Energia', 'Ferramentas'],
    supplierCategories: ['Distribuidora de peças', 'Autopeças', 'Pneus'],
    incomeCategories: ['Serviços de manutenção/reparo', 'Venda de peças'],
    taskTags: ['Orçamento para cliente', 'Reposição de peças', 'Contato com fornecedor', 'Retorno de garantia'],
    calendarEventTypes: ['Atendimento agendado', 'Entrega de veículo/equipamento', 'Entrega de fornecedor'],
    keywordAdditions: {
      'orçamento': 'Orçamento para cliente',
      'peça': 'Reposição de peças',
      'garantia': 'Retorno de garantia',
      'agendamento': 'Atendimento agendado',
    },
    recommendedPlugins: [
      { plugin: 'ordens-de-servico', reason: 'Oficinas costumam precisar controlar ordens de serviço por veículo', confidence: 'alta' },
      { plugin: 'estoque', reason: 'Você mencionou trabalhar com peças, que exigem controle de estoque', confidence: 'media' },
    ],
  },
  salao: {
    key: 'salao',
    label: 'Salão de beleza / Estética',
    icon: 'cut',
    description: 'Serviços de beleza e estética com agendamento',
    keywords: ['salão', 'beleza', 'estética', 'cabelei', 'barbearia', 'manicure', 'spa'],
    defaults: {
      sellsProducts: true,
      providesServices: true,
      hasStock: true,
      hasSuppliers: true,
      hasAppointments: true,
      hasQuotes: false,
    },
    productCategories: ['Cabelo', 'Unhas', 'Estética facial', 'Produtos para revenda'],
    financialCategories: ['Produtos', 'Aluguel', 'Comissões', 'Energia', 'Marketing'],
    supplierCategories: ['Cosméticos', 'Equipamentos'],
    incomeCategories: ['Serviços de beleza/estética', 'Venda de produtos para revenda'],
    taskTags: ['Reposição de produtos', 'Contato com fornecedor', 'Manutenção de equipamentos'],
    calendarEventTypes: ['Atendimento agendado', 'Entrega de fornecedor'],
    keywordAdditions: {
      'agendamento': 'Atendimento agendado',
      'produto': 'Reposição de produtos',
      'equipamento': 'Manutenção de equipamentos',
    },
    recommendedPlugins: [
      { plugin: 'comissoes', reason: 'Salões costumam pagar comissão para profissionais por atendimento', confidence: 'alta' },
      { plugin: 'agenda-avancada', reason: 'Negócios com agendamento se beneficiam de uma agenda por profissional', confidence: 'media' },
    ],
  },
  clinica: {
    key: 'clinica',
    label: 'Clínica / Consultório',
    icon: 'medkit',
    description: 'Atendimento clínico com agendamento',
    keywords: ['clínica', 'consultório', 'dentista', 'psicólog', 'fisioterap', 'médic', 'saúde'],
    defaults: {
      sellsProducts: false,
      providesServices: true,
      hasStock: false,
      hasSuppliers: true,
      hasAppointments: true,
      hasQuotes: false,
    },
    productCategories: ['Materiais de consumo', 'Medicamentos'],
    financialCategories: ['Materiais', 'Aluguel', 'Salários', 'Equipamentos', 'Impostos'],
    supplierCategories: ['Distribuidora de materiais', 'Farmácia'],
    incomeCategories: ['Atendimentos/consultas', 'Convênios/planos de saúde'],
    taskTags: ['Reposição de materiais', 'Contato com fornecedor', 'Retorno de paciente'],
    calendarEventTypes: ['Atendimento agendado', 'Retorno de paciente', 'Entrega de fornecedor'],
    keywordAdditions: {
      'paciente': 'Retorno de paciente',
      'consulta': 'Atendimentos/consultas',
      'convênio': 'Convênios/planos de saúde',
      'material': 'Reposição de materiais',
    },
    recommendedPlugins: [
      { plugin: 'agenda-avancada', reason: 'Clínicas costumam precisar de agenda por profissional/sala', confidence: 'alta' },
      { plugin: 'prontuario', reason: 'Atendimento clínico costuma exigir histórico do paciente', confidence: 'media' },
    ],
  },
  servicos: {
    key: 'servicos',
    label: 'Prestação de serviços',
    icon: 'briefcase',
    description: 'Serviços variados (construção, reforma, técnico, etc.)',
    keywords: ['serviço', 'reforma', 'construção', 'pedreiro', 'eletricista', 'encanador', 'técnico', 'freelancer', 'autônomo'],
    defaults: {
      sellsProducts: false,
      providesServices: true,
      hasStock: false,
      hasSuppliers: true,
      hasAppointments: false,
      hasQuotes: true,
    },
    productCategories: ['Materiais', 'Ferramentas'],
    financialCategories: ['Materiais', 'Deslocamento', 'Ferramentas', 'Impostos'],
    supplierCategories: ['Materiais de construção', 'Ferramentas'],
    incomeCategories: ['Serviços prestados', 'Orçamentos aprovados'],
    taskTags: ['Orçamento para cliente', 'Compra de materiais', 'Retorno de garantia'],
    calendarEventTypes: ['Serviço agendado', 'Entrega de material', 'Prazo de entrega da obra/serviço'],
    keywordAdditions: {
      'orçamento': 'Orçamento para cliente',
      'material': 'Compra de materiais',
      'garantia': 'Retorno de garantia',
      'prazo': 'Prazo de entrega da obra/serviço',
    },
    recommendedPlugins: [
      { plugin: 'orcamentos', reason: 'Você mencionou trabalhar com orçamentos por serviço', confidence: 'alta' },
      { plugin: 'equipe', reason: 'Serviços de obra/reforma costumam envolver equipe própria ou terceirizada', confidence: 'media' },
    ],
  },
  distribuidora: {
    key: 'distribuidora',
    label: 'Distribuidora / Atacado',
    icon: 'cube',
    description: 'Revenda de produtos em maior volume',
    keywords: ['distribuidora', 'atacado', 'atacadista', 'revenda'],
    defaults: {
      sellsProducts: true,
      providesServices: false,
      hasStock: true,
      hasSuppliers: true,
      hasAppointments: false,
      hasQuotes: true,
    },
    productCategories: ['Linha 1', 'Linha 2', 'Linha 3', 'Promocionais'],
    financialCategories: ['Compras', 'Frete', 'Armazenagem', 'Salários', 'Impostos'],
    supplierCategories: ['Fabricantes', 'Importadoras'],
    incomeCategories: ['Vendas no atacado', 'Vendas por pedido/representante'],
    taskTags: ['Reposição de estoque', 'Contato com fornecedor', 'Cobrança de cliente'],
    calendarEventTypes: ['Entrega de fornecedor', 'Entrega ao cliente', 'Pagamento de fornecedor'],
    keywordAdditions: {
      'estoque': 'Reposição de estoque',
      'fornecedor': 'Contato com fornecedor',
      'cobrança': 'Cobrança de cliente',
      'frete': 'Entrega ao cliente',
    },
    recommendedPlugins: [
      { plugin: 'estoque', reason: 'Distribuidoras costumam movimentar grande volume de estoque', confidence: 'alta' },
      { plugin: 'comissoes', reason: 'Vendas por representante costumam envolver comissão', confidence: 'media' },
    ],
  },
  ecommerce: {
    key: 'ecommerce',
    label: 'E-commerce',
    icon: 'globe',
    description: 'Venda de produtos pela internet',
    keywords: ['e-commerce', 'ecommerce', 'loja online', 'venda online', 'marketplace', 'internet'],
    defaults: {
      sellsProducts: true,
      providesServices: false,
      hasStock: true,
      hasSuppliers: true,
      hasAppointments: false,
      hasQuotes: false,
    },
    productCategories: ['Mais vendidos', 'Lançamentos', 'Promoções', 'Linha principal'],
    financialCategories: ['Compras', 'Frete', 'Plataforma/Taxas', 'Marketing', 'Embalagens'],
    supplierCategories: ['Fornecedores', 'Transportadoras'],
    incomeCategories: ['Vendas online', 'Vendas em marketplace'],
    taskTags: ['Reposição de estoque', 'Embalar/expedir pedido', 'Atendimento pós-venda'],
    calendarEventTypes: ['Envio de pedido', 'Entrega de fornecedor', 'Fechamento de campanha/promoção'],
    keywordAdditions: {
      'estoque': 'Reposição de estoque',
      'pedido': 'Embalar/expedir pedido',
      'frete': 'Envio de pedido',
      'marketplace': 'Vendas em marketplace',
    },
    recommendedPlugins: [
      { plugin: 'estoque', reason: 'E-commerces dependem de controle preciso de estoque para não vender o que não tem', confidence: 'alta' },
      { plugin: 'integracao-marketplace', reason: 'Você pode vender em mais de um canal/marketplace', confidence: 'media' },
    ],
  },
  escritorio: {
    key: 'escritorio',
    label: 'Escritório / Consultoria',
    icon: 'business',
    description: 'Serviços profissionais e administrativos',
    keywords: ['escritório', 'consultoria', 'contab', 'advoga', 'agência', 'administra'],
    defaults: {
      sellsProducts: false,
      providesServices: true,
      hasStock: false,
      hasSuppliers: false,
      hasAppointments: true,
      hasQuotes: true,
    },
    productCategories: ['Material de escritório'],
    financialCategories: ['Aluguel', 'Salários', 'Software/Assinaturas', 'Marketing', 'Impostos'],
    supplierCategories: ['Fornecedores de material'],
    incomeCategories: ['Honorários/consultoria', 'Contratos recorrentes'],
    taskTags: ['Entrega de relatório/parecer', 'Cobrança de cliente', 'Renovação de contrato'],
    calendarEventTypes: ['Reunião com cliente', 'Prazo de entrega', 'Renovação de contrato'],
    keywordAdditions: {
      'relatório': 'Entrega de relatório/parecer',
      'contrato': 'Renovação de contrato',
      'reunião': 'Reunião com cliente',
      'prazo': 'Prazo de entrega',
    },
    recommendedPlugins: [
      { plugin: 'contratos-recorrentes', reason: 'Escritórios costumam ter clientes com contrato mensal recorrente', confidence: 'media' },
      { plugin: 'agenda-avancada', reason: 'Você mencionou atendimento agendado com clientes', confidence: 'media' },
    ],
  },
  outro: {
    key: 'outro',
    label: 'Outro tipo de negócio',
    icon: 'ellipsis-horizontal-circle',
    description: 'Um modelo de negócio diferente dos listados',
    keywords: [],
    defaults: {
      sellsProducts: true,
      providesServices: true,
      hasStock: false,
      hasSuppliers: false,
      hasAppointments: false,
      hasQuotes: false,
    },
    productCategories: ['Produtos', 'Serviços'],
    financialCategories: ['Compras', 'Aluguel', 'Salários', 'Impostos'],
    supplierCategories: ['Fornecedores'],
    incomeCategories: ['Vendas/serviços prestados'],
    taskTags: ['Pendência com cliente', 'Reposição/compra', 'Contato com fornecedor'],
    calendarEventTypes: ['Compromisso agendado', 'Pagamento', 'Entrega'],
    keywordAdditions: {
      'cliente': 'Pendência com cliente',
      'fornecedor': 'Contato com fornecedor',
      'entrega': 'Entrega',
    },
    recommendedPlugins: [],
  },
};

export const BUSINESS_PROFILE_LIST = Object.values(BUSINESS_PROFILES);

/**
 * "Motor de análise" mock: tenta reconhecer o tipo de negócio a partir do
 * texto livre digitado pelo usuário, sem nenhuma IA — apenas keywords.
 * Quando a IA existir, esta função é o ponto exato a ser substituído.
 */
export function guessBusinessType(freeText: string): BusinessTypeKey | null {
  const text = freeText.toLowerCase();
  let best: { key: BusinessTypeKey; score: number } | null = null;

  for (const profile of BUSINESS_PROFILE_LIST) {
    if (profile.key === 'outro') continue;
    const score = profile.keywords.reduce(
      (acc, kw) => (text.includes(kw) ? acc + 1 : acc),
      0
    );
    if (score > 0 && (!best || score > best.score)) {
      best = { key: profile.key, score };
    }
  }

  return best?.key ?? null;
}
