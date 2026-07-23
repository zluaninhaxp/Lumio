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
