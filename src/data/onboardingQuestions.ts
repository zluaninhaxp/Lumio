export interface OpenQuestionBlock {
  id: string;
  stage: 1 | 2 | 3 | 4;
  transition?: string;
  question: string;
  followUp: string;
  placeholder: string;
  minLengthForFollowUp: number;
  optional: boolean;
  /**
   * Se presente, a pergunta é exibida como escolha rápida (chips/botões) em
   * vez de campo de texto livre. O valor enviado como resposta é o próprio
   * label escolhido.
   */
  options?: string[];
}

/**
 * Mensagem de introdução, exibida antes de qualquer pergunta. Não conta como
 * bloco/estágio, é só a apresentação do mascote (ver `app/onboarding.tsx`).
 */
export const ONBOARDING_INTRO = {
  lines: [
    'Oi! Eu sou o Lumio 👋 Vou te ajudar a organizar as finanças, tarefas e agenda do seu negócio.',
    'Antes de começar, quero te conhecer um pouco. São só algumas perguntas rápidas, só agora na primeira vez. Depois você pode mudar qualquer resposta nas configurações.',
    'Vamos lá?',
  ],
};

export const OPEN_QUESTIONS: OpenQuestionBlock[] = [
  {
    id: 'visaoGeral',
    stage: 1,
    question:
      'Qual é o **nome do seu negócio**? E **o que ele vende ou faz**, pra quem?',
    followUp:
      'Me conta um pouco mais: qual é o segmento, e o que você vende ou oferece?',
    placeholder:
      'Ex: Tenho uma loja de roupas femininas chamada Estilo Único, atendo mulheres de 20 a 40 anos…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'rotina',
    stage: 1,
    question:
      'Conta como é um **dia normal** no seu negócio: o que acontece **desde a hora que abre até a hora que fecha**?',
    followUp: 'Tem alguma tarefa nesse dia a dia que consome mais tempo do que deveria?',
    placeholder:
      'Ex: Abro às 8h, confiro o estoque, atendo clientes, fecho o caixa às 18h…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'operacao',
    stage: 2,
    question:
      'Você toca o negócio **sozinho ou tem equipe**? E como **controla as finanças** hoje? Usa planilha, caderno, app ou vai de cabeça?',
    followUp: 'Alguém além de você mexe no financeiro, ou fica tudo com você?',
    placeholder:
      'Ex: Somos eu e mais dois funcionários. Uso uma planilha no Excel e anoto as vendas no caderno…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'clientes',
    stage: 2,
    question:
      'Como você se relaciona com seus clientes? Tem **cadastro**, **manda mensagem** ou o contato é **só na hora da venda**?',
    followUp: 'Tem algo que faz eles voltarem?',
    placeholder:
      'Ex: A maioria dos clientes é conhecida, mando novidades pelo WhatsApp, mas não tenho cadastro organizado…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'dores',
    stage: 3,
    question: 'Qual é a **maior dor de cabeça** no seu negócio hoje?',
    followUp: 'Mais alguma coisa que te consome tempo ou dinheiro sem precisar?',
    placeholder:
      'Ex: Tenho dificuldade em saber quanto estou ganhando de verdade…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'sazonalidade',
    stage: 3,
    question: 'O movimento do seu negócio **varia ao longo do ano** ou é **sempre parecido**?',
    followUp: 'Como você se prepara nos períodos mais fracos?',
    placeholder:
      'Ex: Dezembro é bom por causa do Natal, mas janeiro é bem parado…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'objetivos',
    stage: 4,
    question:
      'Nos próximos anos, **o que você quer alcançar** com o negócio? Por exemplo: abrir outra loja, aumentar o faturamento, ter mais tempo livre…',
    followUp: 'O que hoje mais te impede de chegar lá?',
    placeholder:
      'Ex: Quero abrir uma segunda loja em dois anos, mas hoje não consigo nem saber o lucro real da primeira…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'prioridade',
    stage: 4,
    question: 'No Lumio, o que você quer **organizar primeiro**?',
    followUp: '',
    placeholder: '',
    minLengthForFollowUp: 0,
    optional: false,
    options: ['Financeiro', 'Tarefas', 'Agenda'],
  },
  {
    id: 'complemento',
    stage: 4,
    question: 'Quer **contar mais alguma coisa**? Fica à vontade, ou pode pular.',
    followUp: 'Pode falar o que quiser, sem compromisso.',
    placeholder: 'Ex: Também vendo online pelo Instagram, mas de forma bem informal…',
    minLengthForFollowUp: 30,
    optional: true,
  },
];
