export const mockTransactions = [
  { id: '1', date: '17/07', description: 'Gasolina — posto BR', amount: -150, category: 'Combustível' },
  { id: '2', date: '16/07', description: 'Tinta acrílica', amount: -280, category: 'Materiais' },
  { id: '3', date: '15/07', description: 'Parafusos caixa 500un', amount: -95, category: 'Materiais' },
  { id: '4', date: '14/07', description: 'Pagamento cliente João', amount: 800, category: 'Receita' },
  { id: '5', date: '13/07', description: 'Fornecedor de tintas', amount: -350, category: 'Fornecedores' },
  { id: '6', date: '12/07', description: 'Almoço equipe', amount: -90, category: 'Alimentação' },
  { id: '7', date: '11/07', description: 'Serviço oficina Seu Zé', amount: 1200, category: 'Receita' },
  { id: '8', date: '10/07', description: 'Óleo e filtros', amount: -120, category: 'Materiais' },
  { id: '9', date: '09/07', description: 'Aluguel galpão', amount: -600, category: 'Fornecedores' },
  { id: '10', date: '08/07', description: 'Serviço manutenção caminhão', amount: 1200, category: 'Receita' },
];

export const mockTasks = [
  { id: '1', description: 'Fazer orçamento — obra do seu Zé', done: false, dueDate: null, priority: 'alta' as const, subtasks: [] as { id: string; text: string; done: boolean }[], tags: ['Clientes'] as string[], createdAt: '2026-07-15T10:00:00.000Z' },
  { id: '2', description: 'Ligar para fornecedor de tintas', done: false, dueDate: null, priority: 'media' as const, subtasks: [], tags: ['Fornecedor'] as string[], createdAt: '2026-07-14T10:00:00.000Z' },
  { id: '3', description: 'Trocar óleo da van de entrega', done: false, dueDate: null, priority: 'alta' as const, subtasks: [], tags: ['Peças', 'Estoque'] as string[], createdAt: '2026-07-13T10:00:00.000Z' },
  { id: '4', description: 'Comprar material de limpeza', done: true, dueDate: null, priority: 'baixa' as const, subtasks: [], tags: ['Estoque'] as string[], createdAt: '2026-07-12T10:00:00.000Z' },
  { id: '5', description: 'Emitir nota da última venda', done: true, dueDate: null, priority: 'media' as const, subtasks: [], tags: [] as string[], createdAt: '2026-07-11T10:00:00.000Z' },
];

export const mockCalendarEvents = [
  { id: '1', date: '2026-07-17', time: '10:00', description: 'Visita cliente Seu Zé', done: false, type: 'event' as const },
  { id: '2', date: '2026-07-17', time: null, description: 'Repor estoque de parafusos', done: false, type: 'task' as const },
  { id: '3', date: '2026-07-19', time: null, description: 'Repor estoque de parafusos', done: false, type: 'task' as const },
  { id: '4', date: '2026-07-22', time: '14:00', description: 'Reunião com fornecedor', done: false, type: 'event' as const },
  { id: '5', date: '2026-07-24', time: '09:00', description: 'Revisão mensal das contas', done: false, type: 'event' as const },
  { id: '6', date: '2026-07-31', time: null, description: 'Fechar balanço do mês', done: false, type: 'task' as const },
];

export const mockBusiness = {
  name: 'Oficina do João',
  type: 'Oficina mecânica',
  initials: 'OJ',
  categories: ['Combustível', 'Materiais', 'Fornecedores', 'Alimentação'],
  collaborators: [
    { id: '1', name: 'Maria Silva', role: 'Colaboradora', initials: 'MS' },
  ],
};

export const mockSummary = {
  entradas: 3200,
  saidas: 1640,
  saldo: 1560,
  byCategory: [
    { name: 'Combustível', value: 620, max: 1640 },
    { name: 'Materiais', value: 480, max: 1640 },
    { name: 'Fornecedores', value: 350, max: 1640 },
    { name: 'Alimentação', value: 190, max: 1640 },
  ],
};
