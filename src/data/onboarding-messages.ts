import type { ImageSourcePropType } from 'react-native';

export type OnboardingMessageVariant = 'A' | 'B';
export interface SpeechSegment { text: string; emphasis?: boolean }
export interface OnboardingMessage {
  mascot: ImageSourcePropType;
  segments: readonly SpeechSegment[];
}

// Expressions matched against the original 14 speech PNGs. Keep these assets intact.
const happy = require('../../assets/onboarding-expressions/Imagem ChatGPT 25_09_2026, 11_05_57.png');
const smiling = require('../../assets/onboarding-expressions/Imagem ChatGPT 25_09_2026, 11_13_34.png');
const confused = require('../../assets/onboarding-expressions/Imagem ChatGPT 25_09_2026, 11_09_08.png');
const normal = (text: string): SpeechSegment => ({ text });
const green = (text: string): SpeechSegment => ({ text, emphasis: true });
const message = (mascot: ImageSourcePropType, ...segments: SpeechSegment[]): OnboardingMessage => ({ mascot, segments });

export const onboardingAiMessages = {
  A: message(happy, normal('Pronto! Já tenho o que preciso para conhecer melhor o seu negócio. ✨')),
  B: message(smiling, normal('Agora posso usar IA para transformar suas respostas em uma configuração personalizada do Lumio, com categorias, prioridades e sugestões pensadas para a sua rotina.')),
};

// Copy and emphasis transcribed from the approved PNGs, independently of flow prompts.
export const onboardingMessages: Record<number, Record<OnboardingMessageVariant, OnboardingMessage>> = {
  1: {
    A: message(happy, normal('Oi! Eu sou o '), green('Lumio'), normal(' 👋\nVou te ajudar a organizar as finanças, tarefas e agenda do seu negócio.')),
    B: message(smiling, normal('Antes de começar, quero te conhecer um pouco. São só algumas perguntas rápidas, só agora na primeira vez. Depois você pode mudar qualquer resposta nas configurações.')),
  },
  2: {
    A: message(happy, normal('Qual o '), green('nome'), normal(' do seu negócio, o que vocês '), green('vendem ou oferecem'), normal(', e '), green('para quem'), normal(' costuma ser isso?')),
    B: message(confused, normal('Qual é o nome do negócio, o que você vende ou oferece, e pra quem?')),
  },
  3: {
    A: message(smiling, normal('Pensando no seu '), green('financeiro'), normal(': de onde costuma vir o dinheiro que '), green('entra'), normal(', e com que tipo de coisa você costuma '), green('gastar'), normal(' no dia a dia do negócio?')),
    B: message(confused, normal('Me dá mais um exemplo de onde entra e de onde sai dinheiro no seu negócio?')),
  },
  4: {
    A: message(smiling, normal('No dia a dia, que tipo de coisa você costuma precisar '), green('lembrar'), normal(' de fazer ou '), green('organizar'), normal('?')),
    B: message(confused, normal('Tem mais alguma coisa que você vive precisando lembrar ou organizar?')),
  },
  5: {
    A: message(smiling, normal('Tem algum tipo de '), green('compromisso'), normal(' que sempre tem uma '), green('data certa'), normal(' pra acontecer? Tipo uma entrega, pagamento, atendimento marcado...')),
    B: message(confused, normal('Tem outro tipo de compromisso com data certa que também é comum pra você?')),
  },
  6: {
    A: message(smiling, normal('Você toca isso '), green('sozinho'), normal(' ou tem '), green('mais gente'), normal(' envolvida? Se tiver, me conta um pouco o que cada um costuma fazer!')),
    B: message(confused, normal('E as pessoas envolvidas, o que cada uma costuma fazer no dia a dia?')),
  },
  7: {
    A: message(confused, normal('De tudo isso, o que '), green('mais te dá trabalho'), normal(' ou confusão de organizar hoje?')),
    B: message(confused, normal('Me conta mais sobre o que mais pesa para você nisso?')),
  },
};
