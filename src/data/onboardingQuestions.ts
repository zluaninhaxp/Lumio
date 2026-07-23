export interface OpenQuestionBlock {
  id: string;
  stage: 1 | 2 | 3 | 4;
  transition?: string;
  question: string;
  followUp: string;
  placeholder: string;
  minLengthForFollowUp: number;
  optional: boolean;
}

export const OPEN_QUESTIONS: OpenQuestionBlock[] = [
  {
    id: 'visaoGeral',
    stage: 1,
    question:
      'Para começar, me conta um pouco sobre o seu negócio: qual é o nome, o que você vende ou faz, e quem é o seu público?',
    followUp:
      'Quer me dar mais alguns detalhes? Por exemplo, há quanto tempo você atua nesse ramo, ou o que mais te diferencia da concorrência?',
    placeholder:
      'Ex: Tenho uma loja de roupas femininas chamada Estilo Único, atendo mulheres de 20 a 40 anos…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'rotina',
    stage: 1,
    transition: 'Legal! Agora me conta um pouco sobre o dia a dia.',
    question:
      'Como é a rotina de operação do seu negócio? O que acontece desde a abertura até o fechamento?',
    followUp:
      'E como você divide o seu tempo entre as tarefas do dia? Tem algo que ocupa mais horas do que você gostaria?',
    placeholder:
      'Ex: Abro às 8h, confiro o estoque, atendo clientes, fecho o caixa às 18h…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'equipe',
    stage: 2,
    transition: 'Entendi a rotina. E sobre as pessoas?',
    question:
      'Como é a sua equipe hoje? Quantas pessoas trabalham com você, e cada um tem um papel definido ou todo mundo faz de tudo?',
    followUp:
      'Alguém cuida especificamente da parte financeira ou administrativa, ou fica tudo com você?',
    placeholder:
      'Ex: Somos eu e mais dois funcionários. Um fica no caixa e o outro na reposição…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'financas',
    stage: 2,
    transition: 'Agora vamos falar de dinheiro.',
    question:
      'Como você controla as finanças do negócio hoje? Usa planilha, caderno, aplicativo, ou vai de cabeça mesmo?',
    followUp:
      'E você consegue saber com clareza, a qualquer momento, quanto entrou, quanto saiu e quanto sobrou?',
    placeholder:
      'Ex: Uso uma planilha no Excel e anoto as vendas no caderno. Não tenho muito controle do que sobra…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'clientes',
    stage: 3,
    transition: 'Vamos falar dos seus clientes agora.',
    question:
      'Como é o seu relacionamento com os clientes? Você mantém um cadastro, anota preferências, manda mensagens, ou o contato é só no balcão?',
    followUp:
      'E como você acha que os seus clientes enxergam o seu negócio? Tem algum diferencial que faz eles voltarem?',
    placeholder:
      'Ex: A maioria dos clientes é conhecida, mando novidades pelo WhatsApp, mas não tenho cadastro organizado…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'dores',
    stage: 3,
    transition: 'Agora a parte mais sincera.',
    question:
      'Qual é a maior dificuldade que você enfrenta hoje no seu negócio? O que mais tira o seu sono ou te faz perder tempo e dinheiro?',
    followUp:
      'Tem mais alguma coisa que te incomoda ou que você sente que poderia ser muito melhor? Pode desabafar.',
    placeholder:
      'Ex: Tenho dificuldade em saber quanto estou ganhando de verdade. Também perco muito tempo fazendo contas no fim do mês…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'sazonalidade',
    stage: 4,
    transition: 'Quase lá. Mais uma coisa sobre o movimento.',
    question:
      'O movimento do seu negócio varia muito ao longo do ano, ou é constante? Tem épocas mais fortes e mais fracas, ou depende de fatores específicos?',
    followUp:
      'Como você se prepara (ou se vira) nesses períodos de baixa? Faz alguma reserva ou promoção?',
    placeholder:
      'Ex: Dezembro é bom por causa do Natal, mas janeiro é bem parado. Tento fazer um pé de meia no fim do ano…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'objetivos',
    stage: 4,
    transition: 'Falta pouco.',
    question:
      'Onde você quer chegar com o seu negócio? Tem algum objetivo grande — abrir uma segunda loja, aumentar o faturamento, ter mais tempo livre… ou até vender o negócio um dia?',
    followUp:
      'E o que você sente que está te impedindo de chegar lá? Tem alguma meta que parece distante hoje?',
    placeholder:
      'Ex: Quero abrir uma segunda loja em dois anos, mas hoje não consigo nem saber o lucro real da primeira…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'complemento',
    stage: 4,
    transition: 'Para finalizar (essa é opcional).',
    question:
      'Tem mais alguma coisa que você gostaria de me contar sobre o seu negócio que eu não perguntei? Algum detalhe importante que você acha que eu deveria saber?',
    followUp:
      'Fique à vontade para falar o que quiser. Nenhuma informação é irrelevante.',
    placeholder:
      'Ex: Também vendo online pelo Instagram, mas de forma bem informal…',
    minLengthForFollowUp: 30,
    optional: true,
  },
];
