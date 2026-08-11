/**
 * Catálogo FECHADO de plugins/módulos opcionais do Lumio.
 *
 * Os 3 módulos fixos (Tarefas, Calendário, Financeiro) NÃO fazem parte
 * deste catálogo — eles são sempre visíveis, independente de
 * `activatedPlugins`. Este arquivo é a fonte única de verdade sobre quais
 * plugins existem, seus metadados de exibição e se já têm uma tela
 * completa (`implemented: true`) ou uma tela mínima genérica
 * (`implemented: false`, ver `GenericPluginField[]` abaixo e
 * `app/plugins/[id].tsx`).
 *
 * NÃO adicione plugins fora desta lista fechada.
 */

export type PluginId =
  | 'estoque'
  | 'clientes'
  | 'fornecedores'
  | 'agenda'
  | 'orcamentos'
  | 'comissoes'
  | 'equipe'
  | 'entregas'
  | 'vendas'
  | 'contratos';

/** Tipo de campo suportado pelo formulário genérico dos plugins mínimos. */
export type GenericFieldType = 'text' | 'number' | 'select';

export interface GenericPluginField {
  key: string;
  label: string;
  type: GenericFieldType;
  /** Opções, apenas quando type === 'select'. */
  options?: string[];
  placeholder?: string;
  /** Mostrado com destaque na listagem (título do item). */
  primary?: boolean;
}

export interface PluginDefinition {
  id: PluginId;
  label: string;
  /** Nome de ícone Ionicons (sem sufixo -outline; aplicado conforme o estado). */
  icon: string;
  /** Frase curta usada na loja de plugins. */
  description: string;
  /** Caminho da tela do plugin (expo-router). */
  route: string;
  /**
   * true = CRUD completo com tela própria (ver app/plugins/estoque.tsx e
   * app/plugins/clientes.tsx).
   * false = tela mínima funcional genérica, servida por app/plugins/[id].tsx
   * a partir de `fields` abaixo, OU aviso "Em breve" quando o plugin exigir
   * modelagem muito diferente (nenhum caso hoje exige isso).
   */
  implemented: boolean;
  /** Campos do item genérico, usados pela tela mínima (app/plugins/[id].tsx). */
  fields: GenericPluginField[];
  /** Rótulo do que é "um item" deste plugin, ex: "cliente", "fornecedor". */
  itemLabel: string;
  itemLabelPlural: string;
}

export const PLUGIN_REGISTRY: Record<PluginId, PluginDefinition> = {
  estoque: {
    id: 'estoque',
    label: 'Estoque',
    icon: 'cube',
    description: 'Controle itens físicos, quantidade e alerta de mínimo.',
    route: '/plugins/estoque',
    implemented: true,
    itemLabel: 'item',
    itemLabelPlural: 'itens',
    fields: [
      { key: 'name', label: 'Item', type: 'text', primary: true, placeholder: 'Ex: Arroz 5kg' },
      { key: 'quantity', label: 'Quantidade', type: 'number', placeholder: '0' },
      { key: 'unit', label: 'Unidade', type: 'text', placeholder: 'Ex: un, kg, cx' },
      { key: 'category', label: 'Categoria', type: 'text', placeholder: 'Ex: Mercearia' },
      { key: 'minAlert', label: 'Alerta de mínimo', type: 'number', placeholder: '0' },
    ],
  },
  clientes: {
    id: 'clientes',
    label: 'Clientes',
    icon: 'people',
    description: 'Histórico, pendências e recorrência dos seus clientes.',
    route: '/plugins/clientes',
    implemented: true,
    itemLabel: 'cliente',
    itemLabelPlural: 'clientes',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', primary: true, placeholder: 'Nome do cliente' },
      { key: 'contact', label: 'Contato', type: 'text', placeholder: 'Telefone ou e-mail' },
      { key: 'notes', label: 'Observações', type: 'text', placeholder: 'Ex: pagamento em aberto' },
    ],
  },
  fornecedores: {
    id: 'fornecedores',
    label: 'Fornecedores',
    icon: 'briefcase',
    description: 'Quem você compra e os prazos combinados.',
    route: '/plugins/fornecedores',
    implemented: true,
    itemLabel: 'fornecedor',
    itemLabelPlural: 'fornecedores',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', primary: true, placeholder: 'Nome do fornecedor' },
      { key: 'contact', label: 'Contato', type: 'text', placeholder: 'Telefone ou e-mail' },
      { key: 'paymentTerm', label: 'Prazo de pagamento', type: 'text', placeholder: 'Ex: 30 dias' },
      { key: 'notes', label: 'Observações', type: 'text', placeholder: 'Observações' },
    ],
  },
  agenda: {
    id: 'agenda',
    label: 'Agenda / Atendimento',
    icon: 'time',
    description: 'Organize horários marcados com clientes.',
    route: '/(tabs)/calendario',
    implemented: true,
    itemLabel: 'atendimento',
    itemLabelPlural: 'atendimentos',
    fields: [
      { key: 'service', label: 'Serviço', type: 'text', primary: true, placeholder: 'Ex: Corte de cabelo' },
      { key: 'client', label: 'Cliente', type: 'text', placeholder: 'Nome do cliente' },
      { key: 'time', label: 'Horário', type: 'text', placeholder: 'Ex: 14:00' },
      { key: 'duration', label: 'Duração', type: 'text', placeholder: 'Ex: 30 min' },
    ],
  },
  orcamentos: {
    id: 'orcamentos',
    label: 'Orçamentos / Propostas',
    icon: 'document-text',
    description: 'Feche o preço com o cliente antes do serviço.',
    route: '/plugins/orcamentos',
    implemented: true,
    itemLabel: 'orçamento',
    itemLabelPlural: 'orçamentos',
    fields: [
      { key: 'items', label: 'Itens', type: 'text', primary: true, placeholder: 'Ex: 2x Camiseta' },
      { key: 'validUntil', label: 'Validade', type: 'text', placeholder: 'AAAA-MM-DD' },
    ],
  },
  comissoes: {
    id: 'comissoes',
    label: 'Comissões',
    icon: 'cash',
    description: 'Comissões por funcionário sobre vendas concluídas.',
    route: '/plugins/comissoes',
    implemented: true,
    itemLabel: 'comissão',
    itemLabelPlural: 'comissões',
    fields: [
      { key: 'employee', label: 'Funcionário', type: 'text', primary: true, placeholder: 'Nome do funcionário' },
      { key: 'reference', label: 'Referência da venda', type: 'text', placeholder: 'Ex: Venda #123' },
      { key: 'value', label: '% ou valor', type: 'text', placeholder: 'Ex: 10% ou R$ 20' },
    ],
  },
  equipe: {
    id: 'equipe',
    label: 'Equipe',
    icon: 'people-circle',
    description: 'Cadastre funcionários e atribua responsabilidades.',
    route: '/plugins/equipe',
    implemented: true,
    itemLabel: 'funcionário',
    itemLabelPlural: 'funcionários',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', primary: true, placeholder: 'Nome do funcionário' },
      { key: 'role', label: 'Função', type: 'text', placeholder: 'Ex: Vendedor' },
      { key: 'contact', label: 'Contato', type: 'text', placeholder: 'Telefone ou e-mail' },
    ],
  },
  entregas: {
    id: 'entregas',
    label: 'Entregas',
    icon: 'bicycle',
    description: 'Logística de entrega dos seus pedidos.',
    route: '/plugins/entregas',
    implemented: true,
    itemLabel: 'entrega',
    itemLabelPlural: 'entregas',
    fields: [],
  },
  vendas: {
    id: 'vendas',
    label: 'Pedidos / Vendas',
    icon: 'receipt',
    description: 'Registre uma venda com os itens vendidos.',
    route: '/plugins/vendas',
    implemented: true,
    itemLabel: 'venda',
    itemLabelPlural: 'vendas',
    fields: [
      { key: 'items', label: 'Itens vendidos', type: 'text', primary: true, placeholder: 'Ex: 2x Refrigerante' },
      { key: 'total', label: 'Valor total', type: 'number', placeholder: '0' },
      { key: 'paymentMethod', label: 'Forma de pagamento', type: 'text', placeholder: 'Ex: Pix, Cartão' },
    ],
  },
  contratos: {
    id: 'contratos',
    label: 'Contratos / Assinaturas',
    icon: 'document-lock',
    description: 'Cobrança recorrente de clientes.',
    route: '/plugins/contratos',
    implemented: true,
    itemLabel: 'contrato',
    itemLabelPlural: 'contratos',
    fields: [],
  },
};

export const PLUGIN_LIST: PluginDefinition[] = Object.values(PLUGIN_REGISTRY);

/** Ordem de prioridade sugerida para implementação dos plugins mínimos. */
export const PLUGIN_PRIORITY_ORDER: PluginId[] = [
  'fornecedores', 'agenda', 'vendas', 'equipe', 'entregas',
  'orcamentos', 'comissoes', 'contratos',
];

export function getPluginDefinition(id: string): PluginDefinition | undefined {
  return PLUGIN_REGISTRY[id as PluginId];
}

export function isValidPluginId(id: string): id is PluginId {
  return id in PLUGIN_REGISTRY;
}

/**
 * Dependências de ativação entre plugins. Um plugin só pode ser ativado
 * se todos os plugins listados aqui já estiverem ativos. Hoje apenas
 * Comissões depende de Equipe e Vendas (precisa de funcionários e de
 * pedidos concluídos para calcular o valor devido).
 */
export const PLUGIN_DEPENDENCIES: Partial<Record<PluginId, PluginId[]>> = {
  comissoes: ['equipe', 'vendas'],
  entregas: ['vendas'],
  contratos: ['clientes'],
  agenda: ['clientes'],
};

export function canActivatePlugin(
  pluginId: PluginId,
  activatedPlugins: string[],
): { ok: boolean; missing: PluginId[] } {
  const deps = PLUGIN_DEPENDENCIES[pluginId] ?? [];
  const missing = deps.filter((dep) => !activatedPlugins.includes(dep));
  return { ok: missing.length === 0, missing };
}
