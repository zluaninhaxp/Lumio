import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Colors, ControlOpacity, Radius, SurfaceStyles } from '../constants/theme';

/** The 34 dp surface stays inside a non-overlapping 48 dp touch target. */
export function SheetCloseButton({ onPress, disabled = false, label = 'Fechar seleção' }: {
  onPress: () => void; disabled?: boolean; label?: string;
}) {
  return <TouchableOpacity onPress={onPress} disabled={disabled} style={styles.target}
    activeOpacity={ControlOpacity.pressed} accessibilityRole="button"
    accessibilityLabel={label} accessibilityState={{ disabled }}>
    <View style={styles.surface}><Ionicons name="close" size={20} color={Colors.textSecondary} /></View>
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  target: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  surface: { ...SurfaceStyles.filter, width: 34, height: 34, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
});
