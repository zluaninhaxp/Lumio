/**
 * Dicionários extensíveis do motor de CALENDÁRIO (campromissos/eventos).
 *
 * NÃO há regex de frase completa. Palavras/expressões são tabelas
 * consultadas pelo `calendarParser` para decidir intenção e classificação.
 *
 * Princípio (especificação seções 12/13/28-29/32):
 *  - Não dependa da palavra "calendário"/"evento"/"compromisso" para
 *    classificar — captured por `COMPROMISSO_MARKERS` (region span
 *    ampla) e `CALEGORY_KEYWORDS`.
 *  - Não invente tipo: a classificação só atribui `eventType` que
 *    exista em `calendarEventTypes` do onboarding do usuário.
 *  - Negat/passado e perguntas são tratados ANTES da classificação (mesmos
 *    filtros do taskEngine reaproveitados).
 */

/**
 * Palavras/expressões fortes que indicam intenção de COMPROMISSO/EVENTO.
 * Caso a mensagem contenha uma destas E tenha uma data relevante, é
 * candidata a `create_event` ou `create_task_and_event` (ver
 * `calendarParser.decideIntent`).
 */
export const COMPROMISSO_MARKERS = [
  // compromisso explícito
  'compromisso', 'compromissos',
  'reunião', 'reuniao', 'reuniões', 'reunioes',
  'encontro', 'encontros',
  'visita', 'visitar', 'visitar a', 'visita na', 'visita na obra',
  'consulta', 'consulta médica', 'consulta medica',
  'aniversário', 'aniversario', 'aniversariantes',
  'feriado', 'feriados',
  'viagem', 'viajar', 'vou viajar',
  'palestra', 'curso', 'workshop', 'treinamento',
  'entrevista', 'reunião de', 'reuniao de',
  'casamento', 'festa', 'churrasco', 'jantar',
  'aula', 'aulas',
  // narrativa implícita (seção 13)
  'vou a', 'vou à', 'vou na', 'vou no', 'vou ao', 'vou estar na', 'vou estar no',
  'vou encontrar', 'vou falar com', 'vou conversar com',
  'encontrar o', 'encontrar a', 'encontrar com',
  'falar com', 'conversar com',
  'tem reunião', 'tem visita', 'tem consulta', 'tem aniversário',
  'bem marcado', 'marcado com', 'marcado para', 'marcado pra',
  'marquei', 'agendei', 'está marcado', 'esta marcado', 'marcada pra',
  // período/ausência (seção 4 PERÍODO)
  'vou ficar', 'vou trabalhar na', 'vou estar trabalhando',
  // termos religiosos/regionais genéricos não incluidos por segurança
];

/**
 * Marcadores que indicam que a data é um PRAZO (deadline) e não execução.
 * Reaproveitados do taskEngine mas centralizados aqui para clareza — o
 * temporal já conhece "até sexta", "antes de"; aqui refinamos intenção.
 */
export const DEADLINE_LEADS = ['até', 'ate', 'antes de', 'antes da', 'antes do', 'no máximo', 'no maximo', 'ultimo dia', 'último dia'];

/**
 * Marcadores de negação específicos de calendário (seção 32). Aparecem nas
 * frases "não tenho reunião amanhã", "cancelei a reunião", "não vou".
 *
 * Obs.: os marcadores estruturais (`não preciso`, `deixa pra lá`, etc.)
 * já vivem no taskEngine e são aplicados primeiro; aqui cobrimos "não
 * tenho compromisso/reunião/evento/visita" e "cancelei/cancela".
 */
export const CALENDAR_NEGATION_MARKERS = [
  'não vou na', 'nao vou na', 'não vou no', 'nao vou no', 'não vou a', 'nao vou a',
  'não vou viajar', 'nao vou viajar',
  'não tenho compromisso', 'nao tenho compromisso',
  'não tenho reunião', 'nao tenho reuniao', 'nao tenho reunião',
  'sem reunião', 'sem reuniao', 'sem compromisso', 'sem visita',
  'cancelei', 'cancela', 'cancelar',
  'não precisa colocar no calendário', 'nao precisa colocar no calendario',
  'não coloca no calendário', 'nao coloca no calendario',
  'tira do calendário', 'tira do calendario',
];

/**
 * Marcadores de PASSADO explícito para eventos (seção 31). Já parte do
 * taskEngine para tarefas; aqui para eventos (ex.: "ontem tive reunião").
 *
 * Excluímos "ontem"/"anteontem" puros desta lista pois casariam tudo — o
 * detector combina "ontem tive" / "ontem fui" para decidir.
 */
export const CALENDAR_PAST_MARKERS = [
  'tive reunião', 'tive compromisso', 'tive visita',
  'fui na', 'fui no', 'fui à', 'fui ao', 'fui à obra', 'fui à reuniao',
  'estive na', 'estive no',
  'ontem tive', 'anteontem tive',
  'já falei com', 'ja falei com', 'já vi o', 'ja vi o',
];

/**
 * Aliases de EVENT TYPE (não hardcode). Used pelo parser para CASAR a
 * mensagem com labels em `calendarEventTypes` do onboarding.
 *
 * Não inclui listas fixas por empresa — usamos apenas a tabela reverse
 * gerada em tempo de execução a partir do `calendarEventTypes` do
 * usuário (ver `buildEventTypeAliases` em `calendarParser.ts`).
 *
 * Este mapa contém apenas aliases mais genéricos que casam em PT-BR
 * com labels comuns geradas pelo onboarding ("Reuniões", "Visitas",
 * "Entregas", "Compromissos", "Fornecedores", ...). É uma ajudante
 * suplementar: o label só é aplicado se existir na configuração real.
 */
export const DEFAULT_EVENT_TYPE_ALIASES: Record<string, string[]> = {
  // singular/plural/verbos coloquiais da label.
  Reuniões: ['reunião', 'reuniao', 'reuniões', 'reunioes', 'reunir', 'reuni'],
  Visitas: ['visita', 'visitar', 'visitei', 'visitar a obra', 'visita na obra'],
  Entregas: ['entrega', 'entregar', 'entreguei'],
  Compromissos: ['compromisso', 'compromissos', 'marcado', 'marcada'],
  Fornecedores: ['fornecedor', 'fornecedores', 'com fornecedor'],
  Clientes: ['cliente', 'clientes', 'com cliente'],
  Aniversários: ['aniversário', 'aniversario', 'aniversários', 'aniversariantes'],
  Viagens: ['viagem', 'viajar', 'vou viajar', 'viagens'],
};

/**
 * Marcadores de PERÍODO (de segunda a quarta) — ver seção 4.
 */
export const PERIOD_RANGE_PRESETS = [
  // regex legal ,"de segunda até", "de terça a", "entre segunda e sexta"...]
];