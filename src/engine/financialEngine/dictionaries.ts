/**
 * Dicionários extensíveis do motor de FINANCEIRO.
 *
 * Tabelas de sinônimos/conjugações consultadas pelo `financialParser` —
 * sem regex de frase completa. Para ampliar o vocabulário basta editar
 * aqui; nenhum padrão precisa ser reescrito.
 *
 * Direção semântica (seções 5/6 da especificação): os verbos de 1ª pessoa
 * ("paguei", "recebi") definem a direção a partir do ponto de vista do
 * USUÁRIO. "pagou" de 3ª pessoa é ENTRADA quando alguém pagou o usuário
 * ("o cliente pagou", "me pagou") e o parser resolve isso separadamente
 * (PAYER_3RD_PERSON), não por estas tabelas.
 */

// ─── SAÍDA (dinheiro sai do usuário) — REALIZADO ────────────────────
export const OUT_REALIZED_MARKERS = [
  'paguei', 'eu paguei', 'já paguei', 'gastei', 'eu gastei', 'gastamos',
  'comprei', 'eu comprei', 'compramos', 'desembolsei', 'desembolsamos',
  'transferi', 'paguei à', 'paguei a', 'saí da conta', 'saiu da conta',
  'saiu da minha conta', 'saiu', 'custou', 'custei',
  'tive uma despesa', 'tive despesa', 'teve uma despesa', 'foi uma despesa',
  'uma despesa de', 'despesa de', 'despesa com', 'minha despesa',
  'fiz um pagamento', 'fiz o pagamento', 'realizei o pagamento',
  'terminei de pagar', 'acabei de pagar', 'acabei de comprar',
  'paguei a conta', 'quitei', ' quitei ',
  // hábito presente ("todo mês pago...") — reconhecido, sem duplicar
  ' pago ', ' eu pago ', 'fiz um pix', 'fiz pix', 'mandei um pix', 'mandei pix', 'enviei um pix', 'enviei pix', 'transferi um pix', "gastei pacas", "din din saiu", "pagamentozinho", "desembolsei uma grana", "saiu uma grana", "saiu do caixa", "passei no cartão", "passei o cartão", "torrei uma grana", "foi embora da conta", "já quitei isso", "quitei a parada", "paguei tudinho", "gastei uma nota", "saiu uns reais"];

// ─── SAÍDA — FUTURO / OBRIGAÇÃO ─────────────────────────────────────
export const OUT_FUTURE_MARKERS = [
  'vou pagar', 'vou gastar', 'vou comprar', 'vou desembolsar',
  'tenho que pagar', 'tenho de pagar', 'tenho q pagar',
  'tenho que comprar', 'preciso pagar', 'preciso comprar',
  'devo pagar', 'devo comprar', 'devo ao', 'devo à', 'devo para o', 'devo para a',
  'tenho uma conta', 'tenho uma conta de', 'tenho uma conta para pagar',
  'uma conta de', 'conta para pagar', 'para pagar', 'a pagar',
  'tenho que desembolsar', 'irei pagar', 'vou ter que pagar',
  'vou fazer um pix', 'vou fazer pix', 'vou mandar um pix', 'vou enviar um pix', 'preciso fazer um pix',
  'vence', 'vencendo', 'vence dia', 'vence no dia', 'vence em',
  'preciso pagar a conta', 'falta pagar', 'estou devendo', 'tou devendo',
  'tenho que pagar a conta',
];

// ─── ENTRADA (dinheiro entra para o usuário) — REALIZADO ────────────
export const IN_REALIZED_MARKERS = [
  'recebi', 'eu recebi', 'já recebi', 'recebemos',
  'entrou', 'entrou na conta', 'entrou na minha conta', 'entrou um',
  'caiu', 'caiu na conta', 'caiu na minha conta', 'caiu um',
  'vendi', 'eu vendi', 'vendemos', 'ganhei', 'ganhamos', 'a venda de', 'venda de',
  'faturei', 'faturo', 'faturamento de', 'fechei uma venda', 'fechei a venda',
  'me pagou', 'me pagaram', 'me pagaste', 'nos pagou', 'nos pagaram',
  'me passou', 'me passaram', 'me mandou', 'me mandaram', 'transferiram', 'me transferiram',
  'me enviou', 'me depositou', 'depositaram', 'depositou na minha conta',
  'pagou pra mim', 'pagou para mim', 'passou pra mim', 'passou para mim',
  'recebimento de', 'o cliente pagou', 'a cliente pagou', 'os clientes pagaram',
  'cliente me pagou', 'recebi o pagamento', 'recebi o pix',
  // Forma impessoal usada quando o usuário informa que terceiros pagaram.
  'fizeram um pagamento', 'fizeram o pagamento',
  // hábito presente ("recebo todo mês")
  ' eu recebo ', ' recebo ',
];

// ─── ENTRADA — FUTURO / EXPECTATIVA ─────────────────────────────────
export const IN_FUTURE_MARKERS = [
  'vou receber', 'vai me pagar', 'vão me pagar', 'vao me pagar',
  'vai me passar', 'vai me mandar', 'vai me enviar', 'vai me depositar',
  'vai pagar', 'vão pagar', 'vao pagar', 'vai cair', 'vai cair na conta',
  'vai entrar', 'tenho para receber', 'tenho a receber', 'para receber',
  'a receber', 'tenho para receber de', 'devo receber', 'devo receber de',
  'ficou de me pagar', 'ficou de pagar', 'ficou de me passar',
  'vai me pagar em', 'cliente vai pagar', 'o cliente vai pagar',
  'vai me dar', 'me deve', 'está me devendo', 'esta me devendo',
  'vou receber de', 'vou receber do', "vou ganhar", "vou receber uma grana", "vai pingar", "vai cair um dinheiro", "vai entrar uma grana", "entra na conta amanhã", "deve cair", "deve entrar", "está pra cair", "tou pra receber", "vou buscar meu pagamento", "me paga depois", "me paga amanhã", "vai fazer o pix", "vai pixar", "vai transferir", "vai depositar", "vai mandar o pagamento", "fica de me pagar", "combinou de me pagar", "prometeu me pagar", "tem que me pagar", "tenho dinheiro pra entrar", "cair um pix", "receber uma bolada", "vou ter recebimento", "vou faturar", "vai entrar na minha conta", "vai cair na minha conta", "tá pra entrar", "tá pra receber", "to pra receber", "tô esperando cair", "esperando receber", "aguardo pagamento", "pagamento pendente", "tem um pix pra cair", "pix agendado pra cair", "vão depositar pra mim", "vai mandar o valor", "vai me repassar", "me repassa depois", "fica pra me pagar", "vai quitar comigo", "o pagamento vem", "dinheiro a caminho", "grana a caminho", "recebo semana que vem", "entra semana que vem"];

/**
 * Sujeito de 3ª pessoa + "pagou/vai pagar" = o OUTRO paga o usuário
 * (entrada). Ex.: "o cliente pagou 800", "João vai pagar amanhã".
 * O parser confirma pela presença de "me/nos" OU por um substantivo de
 * contraparte antes do verbo.
 */
export const PAYER_3RD_PERSON_PATTERNS: RegExp[] = [
  /\b(?:me|nos)\s+(?:pagou|pagaram|pagando|vai\s+pagar|v[ãa]o\s+pagar|deve\s+pagar)\b/i,
  /\b(?:cliente|clientes|fregu[êe]s|freguesia|comprador|compradores|s[ée]cio|empresa|contratante)\s+(?:me\s+|nos\s+|j[áa]\s+|meu\s+|nossa\s+|noss[oa]s?\s+)*(?:pagou|pagaram|vai\s+pagar|v[ãa]o\s+pagar|deveria\s+pagar|deve\s+pagar|ir[áa]\s+pagar)\b/i,
];

/** Marcadores de negação financeira — NUNCA criam lançamento (seção 22). */
export const FINANCIAL_NEGATION_MARKERS = [
  'não paguei', 'nao paguei', 'não recebi', 'nao recebi',
  'não gastei', 'nao gastei', 'não gastei nada', 'nao gastei nada',
  'não comprei', 'nao comprei', 'não vendi', 'nao vendi',
  'não vou pagar', 'nao vou pagar', 'não vou receber', 'nao vou receber',
  'não vou comprar', 'nao vou comprar', 'não entrei', 'nao entrei',
  'não entrou', 'nao entrou', 'não caiu', 'nao caiu', 'não caiu nada',
  'não pagou', 'nao pagou', 'não me pagou', 'nao me pagou',
  'não me pagaram', 'nao me pagaram', 'ainda não recebi', 'ainda nao recebi',
  'ainda não pagaram', 'ainda nao pagaram', 'ainda não paguei', 'ainda nao paguei',
  'não desembolsei', 'nao desembolsei', 'não recebi ainda', 'nao recebi ainda',
  'não recebemos', 'nao recebemos', 'não gastamos', 'nao gastamos',
];

/** Verbos que indicam COBRANÇA feita pelo usuário — é tarefa, não entrada. */
export const CHARGE_TASK_MARKERS = [
  'preciso cobrar', 'tenho que cobrar', 'vou cobrar', 'cobrar o', 'cobrar a',
  'preciso cobrar o', 'lembrar de cobrar', 'me lembra de cobrar',
];

/** Início de pergunta de consulta financeira. */
export const QUERY_STARTERS = [
  'quanto eu gastei', 'quanto gastei', 'quanto eu gastey', 'quanto gastamos',
  'quanto eu recebi', 'quanto recebi', 'quanto recebemos',
  'quanto entrou', 'quanto entra', 'quanto vendeu', 'quanto eu vendi', 'quanto vendi',
  'quanto vendemos', 'quanto faturei', 'qual foi meu faturamento', 'qual meu faturamento',
  'quanto tenho para receber', 'quanto tenho a receber', 'quanto tenho pra receber',
  'quanto tenho para pagar', 'quanto tenho a pagar', 'quanto tenho pra pagar',
  'quanto devo', 'quanto eu devo', 'quanto estou devendo',
  'qual foi minha maior despesa', 'qual minha maior despesa', 'qual a maior despesa',
  'quanto eu gastei com', 'quanto gastei com', 'quanto gastei de',
  'quanto entrou hoje', 'quanto gastei hoje', 'quanto vendi hoje',
  'quanto eu gastei esse mês', 'quanto gastei esse mes', 'quanto gastei esse mês',
  'resumo do mês', 'resumo do mes', 'resumo financeiro', 'meu saldo',
  'qual meu saldo', 'qual é meu saldo', 'como está o financeiro', 'como esta o financeiro',
  'balanço', 'balanco', 'relatório financeiro', 'relatorio financeiro',
];

/** Verbos de consulta (com início interrogativo) para classificação. */
export const QUERY_INCOME_HINTS = ['recebi', 'entrou', 'vendi', 'faturei', 'faturamento', 'vendeu'];
export const QUERY_EXPENSE_HINTS = ['gastei', 'gastamos', 'despesa', 'devo', 'devendo', 'paguei'];
export const QUERY_RECEIVABLE_HINTS = ['para receber', 'a receber', 'pra receber', 'me deve', 'me devendo', 'receber'];
export const QUERY_PAYABLE_HINTS = ['para pagar', 'a pagar', 'pra pagar', 'devo', 'devendo'];

/** Verbos de edição/exclusão (intenção reconhecida, NÃO executada — seção 31). */
export const EDIT_VERBS = [
  'corrige', 'corrigir', 'corrigi', 'corrige aquele', 'muda', 'mudar', 'mude',
  'altera', 'alterar', 'atualiza', 'atualizar', 'arruma', 'arrumar',
];
export const DELETE_VERBS = [
  'remove', 'remover', 'removi', 'exclui', 'excluir', 'excluí',
  'apaga', 'apagar', 'deleta', 'deletar', 'cancela aquele', 'cancelar aquele',
];
/** Substantivos que indicam que o verbo de edição mira um lançamento. */
export const ENTRY_NOUNS = [
  'lançamento', 'lancamento', 'pagamento', 'despesa', 'receita',
  'movimentação', 'movimentacao', 'transação', 'transacao',
  'entrada', 'saída', 'saida', 'registro', 'compra', 'venda', 'conta',
];

/** Recorrência (seção 37) — reconhecida, sem lançamentos automáticos. */
export const RECURRENCE_PATTERN =
  /\b(?:todo\s+(?:dia|m[êe]s|mes|semana|ano)|todos\s+(?:os|as)\s+(?:dias|meses|semanas|anos)|todas\s+as\s+semanas|mensalmente|semanalmente|diariamente)\b/i;

/**
 * Aliases padrão palavra -> label de categoria COMUM. Aplicados SOMENTE
 * quando o label existe nas categorias reais do onboarding do usuário
 * (nunca inventa categoria — espelha `DEFAULT_EVENT_TYPE_ALIASES` do
 * calendarEngine). O keywordMap do onboarding tem prioridade.
 */
export const DEFAULT_FINANCE_CATEGORY_ALIASES: Record<string, string[]> = {
  Combustível: ['gasolina', 'diesel', 'etanol', 'álcool', 'alcool', 'combustível', 'combustivel', 'posto', 'abasteci', 'tanque'],
  Material: ['material', 'materiais', 'cimento', 'areia', 'brita', 'tinta', 'tubo', 'tubos', 'madeira', 'parafuso', 'parafusos', 'telha', 'vergalhão', 'vergalhao'],
  Materiais: ['material', 'materiais', 'cimento', 'areia', 'brita', 'tinta', 'tubo', 'tubos', 'madeira', 'parafuso', 'parafusos', 'telha', 'vergalhão', 'vergalhao'],
  Funcionários: ['funcionário', 'funcionario', 'funcionários', 'funcionarios', 'salário', 'salario', 'salários', 'salarios', 'folha', 'empregado', 'empregados', 'ajudante', 'pedreiro', 'diária', 'diaria', 'diarista'],
  Alimentação: ['alimentação', 'alimentacao', 'almoço', 'almoco', 'janta', 'jantar', 'comida', 'mercado', 'lanche', 'padaria', 'café', 'cafe'],
  Fornecedores: ['fornecedor', 'fornecedores'],
  Frete: ['frete', 'freteiro', 'carreto'],
  Aluguel: ['aluguel', 'aluguéis', 'alugueis', 'renda do galpão'],
  Transporte: ['transporte', 'uber', 'frete', 'corrida'],
  Impostos: ['imposto', 'impostos', 'taxa', 'taxas', 'daru', 'simples nacional'],
  Serviços: ['serviço', 'servico', 'serviços', 'servicos', 'manutenção', 'manutencao'],
  Energia: ['energia', 'luz', 'electricidade', 'eletricidade', 'conta de luz'],
  Água: ['água', 'agua', 'conta de água', 'conta de agua'],
  Telefone: ['telefone', 'celular', 'internet', 'plano'],
};

/**
 * Nomes de unidade/quantidade: um número seguido destas palavras é
 * QUANTIDADE, não dinheiro ("10 sacos de cimento" — seção 9).
 */
export const QUANTITY_UNITS = new Set([
  'saco', 'sacos', 'peça', 'peças', 'pecas', 'peca', 'caixa', 'caixas',
  'pacote', 'pacotes', 'litro', 'litros', 'metro', 'metros', 'm2', 'm³',
  'quilo', 'quilos', 'kg', 'kgs', 'tonelada', 'toneladas', 'unidade',
  'unidades', 'un', 'par', 'pares', 'parafuso', 'parafusos', 'tijolo',
  'tijolos', 'barril', 'barris', 'bomba', 'bombas', 'rolo', 'rolos',
  'galão', 'galao', 'galões', 'galoes', 'lata', 'latas', 'viagem', 'viagens',
  'caminhão', 'caminhao', 'caminhões', 'caminhoes', 'carga', 'cargas',
  'hora', 'horas', 'dia', 'dias', 'semana', 'semanas', 'mês', 'mes', 'meses',
  'pessoa', 'pessoas', 'funcionário', 'funcionario', 'pedido', 'pedidos',
  'serviço', 'servico', 'serviços', 'servicos', 'obra', 'obras',
]);

/** Palavras de valor informal/gíria (marcador forte de dinheiro). */
export const MONEY_SLANG = new Set(['conto', 'contos', 'pila', 'pilas', 'mingau', 'real', 'reais', 'r$']);

/** Palavras que marcam valor por unidade ("5 peças a 50 cada" -> 250). */
export const EACH_UNIT_WORDS = ['cada', 'a unidade', 'por unidade', 'a peça', 'a peça.', 'unitário', 'unitario'];
