import { StyleSheet, Text } from 'react-native';

/**
 * Textos exibidos durante a animação de "pensando" na tela de celebração
 * (`app/celebration.tsx`), enquanto a extração das respostas do onboarding
 * é calculada. O texto de "done" é substituído por um definitivo naquela
 * tela assim que a análise termina.
 */
const PHASE_TEXT = {
  thinking: 'Analisando o que você me contou...',
  focused: 'Organizando tudo certinho pra você...',
} as const;

export default function CelebrationText({ phase }: { phase: keyof typeof PHASE_TEXT }) {
  return <Text style={styles.text}>{PHASE_TEXT[phase]}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 26,
  },
});
