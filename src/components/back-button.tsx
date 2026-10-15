import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity } from 'react-native';

/** Shared presentation originally used by the onboarding header. */
export function BackButton({ onPress, accessibilityLabel = 'Voltar' }: {
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
    <Ionicons name="chevron-back" size={26} color="#087E68" />
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  button: { width: 48, height: 48, borderRadius: 18, backgroundColor: 'rgba(246,255,251,0.82)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(216,241,231,0.9)', shadowColor: '#3D8C75', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
});
