import { View } from 'react-native';
import { Colors, Spacing } from '../../constants/theme';
import { LoadingSpinner } from "../loading-spinner";

export function SkeletonLoader() {
  return <View style={{ padding: Spacing.lg }}><LoadingSpinner size="small" color={Colors.accentIcon} accessibilityLabel="Carregando" /></View>;
}
