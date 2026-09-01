/**
 * Dicionários extensíveis do motor de tarefas.
 *
 * NÃO há regex de frase completa aqui — são tabelas de sinônimos/conjugações
 * consumidas pelos extratores. Para adicionar um verbo ou variação basta
 * editar este arquivo; nenhum padrão precisa ser reescrito.
 *
 * Convenção: cada ação canônica é o infinitivo (ex.: "comprar"). As
 * variações cobrem conjugações comuns no português falado informal, abreviações
 * e formas coloquiais. O matching é feito sobre o texto normalizado em lower.
 */

/**
 * Ações reconhecidas e suas variações. A chave é o infinitivo canônico.
 * As variações NÃO precisam cobrir todas as conjugações — o extrator também
 * tenta derivar o infinitivo removendo terminações (-ar/-er/-ir/-or) e
 * desinências do imperativo/gerúndio.
 */
export const ACTION_DICTIONARY: Record<string, string[]> = {
  comprar: ['comprar', 'compra', 'compre', 'comprarem', 'adquirir', 'adquira', 'adquire', 'pegar', 'pegue', 'buscar', 'busque', 'providenciar', 'providencie', 'arrumar', 'arrume', "comprinhas", "comprar rapidinho", "ir às compras", "pegar pra mim", "buscar pra mim", "providenciar pra ontem", "dar um pulo pra comprar", "passar no mercado", "fazer a compra", "faze a compra", "compra ai", "compra pra nós", "cata pra mim", "descola pra mim"],
  pagar: ['pagar', 'pague', 'paga', 'liquidar', 'quitei', 'saldar'],
  cobrar: ['cobrar', 'cobre', 'cobrança', 'cobranca'],
  ligar: ['ligar', 'ligue', 'liga', 'ligue', 'telefonar', 'telefone', 'chamar', 'chame', 'liga pra', 'liga pro'],
  enviar: ['enviar', 'envie', 'envia', 'manda', 'mandar', 'mande', 'mandar', 'mandar mensagem', 'mandar msg', 'mandar whatsapp', 'mandar zap', 'encaminhar', 'encaminhe', 'remeter'],
  verificar: ['verificar', 'verifique', 'verifica', 'conferir', 'confira', 'confere', 'checar', 'cheque', 'checa', 'olhar', 'olhe', 'olha', 'analisar', 'analise', 'revisar', 'revise', 'validar', 'valide', 'ver', 've', 'vejo'],
  separar: ['separar', 'separe', 'separa', 'reservar', 'reserve'],
  entregar: ['entregar', 'entregue', 'entrega', 'levar', 'leve', 'leva', 'sai pra', 'sair pra'],
  buscar: ['buscar', 'busque', 'busca', 'ir buscar', 'ir pegar', 'ir pegar', 'retirar', 'retire'],
  instalar: ['instalar', 'instale', 'instala', 'montar', 'monte', 'monta'],
  resolver: ['resolver', 'resolva', 'resolve', 'solucionar', 'solucione'],
  preparar: ['preparar', 'prepare', 'prepara', 'deixar pronto', 'deixar prontin'],
  fazer: ['fazer', 'faz', 'faça', 'faca', 'faço', 'fezer', 'executar', 'execute'],
  organizar: ['organizar', 'organize', 'organiza', 'arrumar', 'arrume', 'reorganizar'],
  agendar: ['agendar', 'agende', 'marca', 'marcar', 'marque'],
  confirmar: ['confirmar', 'confirme', 'confirma', 'confirmar'],
  solicitar: ['solicitar', 'solicite', 'solicita', 'pedir', 'peça', 'pede', 'peca'],
  visitar: ['visitar', 'visite', 'visita', 'passar em', 'passar na', 'passar no'],
  responder: ['responder', 'responda', 'responde', 'retornar', 'retorne', 'retorna', 'dar retorno', 'mandar retorno', 'falar com', 'falar com'],
  falar: ['falar', 'fale', 'fala', 'conversar', 'converse', 'conversa', 'entrar em contato', 'contatar', 'contate'],
  acompanhar: ['acompanhar', 'acompanhe', 'acompanha', 'monitorar', 'monitorar'],
  revisar: ['revisar', 'revise', 'revisa'],
  corrigir: ['corrigir', 'corrija', 'corrije', 'corrigi'],
  cotar: ['cotar', 'cote', 'fazer cotação', 'fazer cotacao'],
  orcar: ['orçar', 'orce', 'orçamento', 'orcamento', 'fazer orçamento', 'fazer orcamento'],
  atualizar: ['atualizar', 'atualize', 'atualiza', 'atualizar'],
  limpar: ['limpar', 'limpe', 'limpa', 'faxinar', 'faxine'],
  estudar: ['estudar', 'estude', 'estuda'],
  planejar: ['planejar', 'planeje', 'planeja'],
};

/** Mapa reverso: variação (lower) -> canônico, montado uma vez. */
const VARIATION_TO_CANONICAL: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [canon, vars] of Object.entries(ACTION_DICTIONARY)) {
    map[canon] = canon;
    for (const v of vars) {
      if (v) map[v.toLowerCase()] = canon;
    }
  }
  return map;
})();

/**
 * Dado um token/palavra (lower), tenta encontrar a ação canônica.
 * Primeiro busca exata no dicionário reverso, depois tenta derivar o
 * infinitivo por heurística de terminação (imperativo/gerúndio/p passé).
 * Retorna null se nada matchear com confiança.
 */
export function resolveAction(word: string): string | null {
  const w = word.toLowerCase().trim();
  if (!w) return null;
  if (VARIATION_TO_CANONICAL[w]) return VARIATION_TO_CANONICAL[w];

  // Heurística de imperativo: remove terminação e tenta reconstituir infinitivo.
  // Ex.: "compra" -> "comprar", "verifica" -> "verificar".
  // Evita falsos removendo só quando o radical bate num verbo conhecido.
  for (const canon of Object.keys(ACTION_DICTIONARY)) {
    const radical = canon.replace(/(ar|er|ir|or)$/, '');
    if (radical.length >= 3 && (w.startsWith(radical) || w === radical)) {
      // só aceita se o que sobra for sufixo comum de conjugação
      const rest = w.slice(radical.length);
      if (rest === '' || /^a|e|ou|ado|ido|ando|endo|indo|ar|er|ir|ou$/.test(rest) || /^[aeiou]r?$/.test(rest)) {
        return canon;
      }
    }
  }
  return null;
}

/**
 * Gatilhos de INTENÇÃO de criação. Aparecem frequentemente em tarefas implícitas:
 * necessidade, comando, lembrete, planejamento, compromisso, solicitação
 * indireta, contexto narrativo.
 */
export const INTENT_TRIGGERS = [
  // necessidade
  'preciso', 'precisamos', 'precisa', 'tenho que', 'temos que', 'tem que', 'tenho q', 'tem q',
  'eu preciso', 'eu tenho que', 'devo', 'devemos', 'devia', 'deveria',
  // lembrete
  'me lembra', 'me lembre', 'me lembrar', 'me lembra de', 'não esquece', 'nao esquece', 'não esquecer', 'nao esquecer', 'não posso esquecer', 'nao posso esquecer', 'não esquece de', 'nao esquece de', 'anota', 'anote', 'anota aí', 'anota ai', 'anotar',
  // comando/adicionar
  'adiciona', 'adicione', 'adicionar', 'cria', 'crie', 'criar', 'coloca', 'coloque', 'colocar', 'bota', 'põe', 'pone', 'inclui', 'inclua', 'incluir', 'registra', 'registre', 'registrar',
  'coloca pra', 'coloca pro', 'coloca na lista', 'coloca na minha lista', 'coloca na lista de tarefas',
  'faz pra mim', 'faz pra eu', 'fala pra eu', 'fala pra mim', 'pede pra eu',
  // planejamento/temporal
  'amanhã eu', 'amanha eu', 'hoje eu', 'sexta eu', 'segunda eu', 'essa semana eu', 'essa semana preciso', 'essa semana tenho', 'semana que vem eu', 'semana que vem preciso', 'no fim da semana eu',
  // compromisso
  'ficou pra', 'ficou para', 'ficou faltando', 'combinei de', 'combinamos de', 'fiquei de', 'ficou combinado',
  // solicitação indireta / narrativa
  'seria bom', 'quero', 'queria', 'preciso deixar', 'tenho que dar um retorno', 'preciso que', 'eu preciso que', 'mandei', 'pediu pra', 'pediu para', 'falou que', 'falou pra', 'falou para', 'disse que', 'quer que eu', 'preciso deixar isso',
  // explícito
  'nova tarefa', 'tarefa nova', 'adiciona uma tarefa', 'adiciona tarefa', 'cria uma tarefa', 'cria tarefa', 'adiciona tarefa pra',
];

/**
 * Marcadores de NEGÃO / não-tarefa. Se a mensagem contiver um destes,
 * o motor decide NÃO criar tarefa (com peso apropriado).
 *
 * Alguns incluem passado ("comprei", "já fiz") porque indicam ação concluída,
 * não planejada. Outros são negação direta do desejo ("não preciso").
 */
export const NEGATION_MARKERS = [
  'não preciso', 'nao preciso', 'não quero', 'nao quero', 'não precisa', 'nao precisa',
  'não é necessário', 'nao e necessario', 'não é preciso', 'nao e preciso',
  'não vou fazer', 'nao vou fazer', 'não vou comprar', 'nao vou comprar',
  'não vou', 'nao vou', 'não tenho que', 'nao tenho que', 'não tenho q', 'nao tenho q',
  'deixa pra lá', 'deixa para la', 'deixa pra la', 'deixar pra lá', 'deixa quieto',
  'cancela', 'cancelei', 'cancelei isso', 'esquece isso', 'ignora isso', 'dispensa',
];

/**
 * Marcadores de PASSADO / ação já realizada. Por si só não são negação
 * explícita, mas indicam que a ação já aconteceu (não é uma tarefa a fazer).
 * O detector de intenção usa estes para baixar a confiança ou descartar.
 */
export const PAST_DONE_MARKERS = [
  'já comprei', 'ja comprei', 'já fiz', 'ja fiz', 'já resolvi', 'ja resolvi',
  'já paguei', 'ja paguei', 'já liguei', 'ja liguei', 'já mandei', 'ja mandei',
  'já enviei', 'ja enviei', 'já entreguei', 'ja entreguei', 'já falei', 'ja falei',
  'já separei', 'ja separei', 'já conferi', 'ja conferi', 'já verifiquei', 'ja verifiquei',
  'já contatei', 'ja contatei', 'comprei', 'paguei', 'liguei', 'mandei', 'enviei',
  'entreguei', 'falei', 'separei', 'conferi', 'verifiquei', 'contatei',
  'ontem', 'anteontem',
];

/**
 * Marcadores de PERGUNTA — a mensagem não é uma tarefa, é uma consulta.
 * Note: alguns podem coexistir com tarefas (ráros), mas na prática perguntas
 * como "quanto custa", "onde compro", "você acha que eu devo" não criam tarefa.
 */
export const QUESTION_MARKERS = [
  'quanto custa', 'quanto fica', 'quanto eh', 'quanto é',
  'onde compro', 'onde compro', 'aonde compro', 'onde fica',
  'você acha que', 'voce acha que', 'vc acha que', 'a gente deve', 'devo comprar',
  'será que', 'sera que', 'será que eu', 'sera que eu',
  '?', 'como faço', 'como eu faço', 'o que eu faço',
];

/** Palavras de preposição/artigo de ligação que unem múltiplas tarefas. */
export const TASK_DELIMITERS = [' e ', ', ', ', e ', '; ', ' depois ', ' e depois '];

/**
 * Abreviações/colquialismos a normalizar ANTES do matching.
 * Aplicadas sobre o texto lower (a normalização de acentos é separada).
 * Chave = ocorrência exata (lower), valor = expansão.
 */
export const ABBREVIATIONS: Record<string, string> = {
  'q': 'que',
  'q ': 'que ',
  'pra': 'para',
  'pro': 'para o',
  'pra o': 'para o',
  'pra a': 'para a',
  'prs': 'para os',
  'tá': 'está',
  'ta': 'está',
  'vc': 'você',
  'vcs': 'vocês',
  'msg': 'mensagem',
  'app': 'aplicativo',
  'blz': 'beleza',
  'add': 'adicionar',
  'agr': 'agora',
  'agr ': 'agora ',
};