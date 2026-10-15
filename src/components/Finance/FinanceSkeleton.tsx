import { ActivityIndicator, View } from 'react-native';
import { Colors, Spacing } from '../../constants/theme';

export function FinanceSkeleton() {
  return <View style={{ padding: Spacing.lg }}><ActivityIndicator size="small" color={Colors.accentIcon} accessibilityLabel="Carregando" /></View>;
}
