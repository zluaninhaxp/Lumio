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
      'Para começar, me conta: **qual o nome do seu negócio**, **o que você vende ou faz** e **quem é o seu público**?',
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
    question:
      'Legal! Agora me conta: **como é a rotina do seu negócio**? O que acontece **desde a abertura até o fechamento**?',
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
    question:
      'Entendi a rotina! E sobre pessoas: **quantas trabalham com você**? Cada um tem **um papel definido** ou todo mundo faz de tudo?',
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
    question:
      'Agora vamos falar de dinheiro. **Como você controla as finanças**? Usa **planilha, caderno, app** ou vai de cabeça?',
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
    question:
      'Vamos falar dos seus clientes. Você mantém **cadastro, anota preferências, manda mensagens** ou o contato é só no balcão?',
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
    question:
      'Agora a parte mais sincera: **qual a maior dificuldade** que você enfrenta? O que mais **tira seu sono** ou **faz perder tempo e dinheiro**?',
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
    question:
      'Quase lá! O movimento do seu negócio **varia muito ao longo do ano** ou é constante? Tem **épocas mais fortes e mais fracas**?',
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
    question:
      'Falta pouco! **Aonde você quer chegar**? Tem algum objetivo grande — **abrir outra loja, aumentar faturamento, ter mais tempo livre**?',
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
    question:
      'Para finalizar (essa é opcional): tem **mais alguma coisa** que você gostaria de me contar que eu não perguntei?',
    followUp:
      'Fique à vontade para falar o que quiser. Nenhuma informação é irrelevante.',
    placeholder:
      'Ex: Também vendo online pelo Instagram, mas de forma bem informal…',
    minLengthForFollowUp: 30,
    optional: true,
  },
];
