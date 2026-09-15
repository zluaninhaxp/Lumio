/** Palavras que introduzem uma intenção de criar tarefa. */
export const TRIGGER_WORDS = new Set([
  'preciso', 'precisamos', 'precisa', 'tenho', 'tem', 'temos', 'devo', 'devemos', 'devia', 'deveria',
  'lembra', 'lembre', 'lembrar', 'anota', 'anote', 'anotar', 'adiciona', 'adicione', 'adicionar',
  'aí', 'ai', 'cria', 'crie', 'criar', 'coloca', 'coloque', 'colocar', 'inclui', 'inclua', 'incluir',
  'fala', 'fale', 'pede', 'peça', 'peca', 'bota', 'põe', 'pone', 'registra', 'registre',
  'fica', 'ficou', 'quero', 'queria', 'seria', 'bom',
]);

/** Function words e conectores que não devem sobrar no título/descrição. */
export const FILLER_WORDS = new Set([
  'que', 'de', 'da', 'do', 'das', 'dos', 'um', 'uma', 'uns', 'umas',
  'o', 'a', 'os', 'as', 'e', 'pra', 'pro', 'para', 'com', 'sem', 'no', 'na', 'nos', 'nas',
  'isso', 'aquilo', 'aquele', 'essa', 'esse', 'este', 'esta', 'meu', 'minha', 'nosso', 'nossa',
  'eu', 'ele', 'ela', 'vocês', 'voce', 'vc', 'agora', 'já', 'ja', 'não', 'nao',
  'preciso', 'precisamos', 'precisa', 'tenho', 'tem', 'temos', 'devo', 'devemos',
  'vai', 'vao', 'vão', 'foi', 'foram', 'ia', 'indo', 'tinha',
  'pediu', 'falou', 'disse', 'quer', 'queria',
  'nós', 'nos', 'mim', 'eles', 'elas', 'me', 'te', 'se', 'lhe',
]);
