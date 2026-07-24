import { StyleSheet, Text } from 'react-native';

const WELCOME_TEXT = 'Tudo pronto! Agora vamos organizar sua empresa juntos.';

export default function CelebrationText() {
  return <Text style={styles.text}>{WELCOME_TEXT}</Text>;
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
