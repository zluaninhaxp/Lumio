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
   *
   * Nenhum dos 6 blocos atuais usa este campo — o roteiro atual é 100%
   * pergunta aberta, de propósito. O campo permanece no tipo apenas para
   * não quebrar suporte a esse padrão caso um bloco futuro precise dele.
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

/**
 * Roteiro de onboarding reorientado: cada bloco existe para alimentar um
 * extrator específico de categorias/tags dos 3 módulos do app (Financeiro,
 * Tarefas, Calendário) — ver `src/ai/types.ts` (OnboardingExtractionResult)
 * e `src/ai/extractionPrompt.ts`. Perguntas genéricas sobre visão de futuro,
 * história do negócio, sazonalidade e relacionamento com clientes deixaram
 * de ser blocos dedicados — se o usuário tocar nesses assuntos
 * espontaneamente, ótimo, mas não perguntamos mais por eles diretamente.
 *
 * Os 6 blocos ficam distribuídos em 4 estágios (barra de progresso) assim:
 * estágio 1 → negocio; estágio 2 → financas + tarefas; estágio 3 →
 * compromissos + equipe; estágio 4 → atrito.
 */
export const OPEN_QUESTIONS: OpenQuestionBlock[] = [
  {
    id: 'negocio',
    stage: 1,
    question:
      'Me conta rapidinho: qual o **nome do seu negócio**, o que vocês **vendem ou oferecem**, e pra **quem** costuma ser isso?',
    followUp:
      'Me conta um pouco mais: qual é o nome do negócio, o que você vende ou oferece, e pra quem?',
    placeholder:
      'Ex: Tenho uma loja de roupas femininas chamada Estilo Único, atendo mulheres de 20 a 40 anos…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'financas',
    stage: 2,
    question:
      'Pensando no seu **financeiro**: de onde costuma **vir o dinheiro** que entra, e com que tipo de coisa você costuma **gastar** no dia a dia do negócio?',
    followUp: 'Me dá mais um exemplo de onde entra e de onde sai dinheiro no seu negócio?',
    placeholder:
      'Ex: Entra dinheiro das vendas no balcão e pelo Instagram. Gasto com material, aluguel e fornecedor…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'tarefas',
    stage: 2,
    question:
      'No dia a dia, que tipo de coisa você costuma precisar **lembrar de fazer ou organizar**? Pode ser desde **repor algo** até **resolver uma pendência** com alguém.',
    followUp: 'Tem mais alguma coisa que você vive precisando lembrar ou organizar?',
    placeholder:
      'Ex: Preciso lembrar de repor estoque, ligar pra fornecedor, cobrar cliente atrasado…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'compromissos',
    stage: 3,
    question:
      'Tem algum tipo de **compromisso que sempre tem uma data certa** pra acontecer — tipo entrega, pagamento, atendimento marcado, reunião? Me conta como costuma ser isso.',
    followUp: 'Tem outro tipo de compromisso com data certa que também é comum pra você?',
    placeholder:
      'Ex: Tenho entrega toda sexta, pagamento de fornecedor no início do mês, e atendimentos marcados…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'equipe',
    stage: 3,
    question:
      'Você toca isso **sozinho ou tem mais gente envolvida**? Se tiver, me conta um pouco **o que cada um costuma fazer**.',
    followUp: 'E as pessoas envolvidas, o que cada uma costuma fazer no dia a dia?',
    placeholder:
      'Ex: Somos eu e mais dois funcionários: um cuida do atendimento e outro da entrega…',
    minLengthForFollowUp: 30,
    optional: false,
  },
  {
    id: 'atrito',
    stage: 4,
    question: 'De tudo isso, o que **mais te dá trabalho ou confusão** de organizar hoje?',
    followUp: 'Me conta mais sobre o que mais pesa nisso pra você hoje?',
    placeholder:
      'Ex: Tenho dificuldade em saber quanto estou ganhando de verdade…',
    minLengthForFollowUp: 30,
    optional: false,
  },
];
