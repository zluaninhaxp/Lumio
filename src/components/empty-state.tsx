import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, TextStyles, Typography } from '../constants/theme';

export const EmptyStateVariants = {
  compact: { circle: 56, icon: 28, gap: Spacing.sm, padding: Spacing.xxl },
  spacious: { circle: 64, icon: 32, gap: Spacing.md, padding: Spacing.xxxl },
} as const;

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description?: string;
  variant?: keyof typeof EmptyStateVariants;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/** Compact beneath summaries/calendars; spacious for primary empty lists. No extra card surface. */
export function FeedbackEmptyState({ icon, title, description, variant = 'spacious', style, children }: Props) {
  const metrics = EmptyStateVariants[variant];
  return <View style={[styles.container, { gap: metrics.gap, paddingVertical: metrics.padding }, style]}>
    <View accessible={false} importantForAccessibility="no-hide-descendants"
      style={[styles.icon, { width: metrics.circle, height: metrics.circle, borderRadius: metrics.circle / 2 }]}>
      <Ionicons name={icon} size={metrics.icon} color={Colors.accentIcon} />
    </View>
    <Text style={styles.title}>{title}</Text>
    {!!description && <Text style={styles.description}>{description}</Text>}
    {children}
  </View>;
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: Spacing.xl },
  icon: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accentLight },
  title: { ...TextStyles.screenTitle, fontFamily: Typography.semibold, textAlign: 'center', maxWidth: 340 },
  description: { ...TextStyles.metadata, fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', maxWidth: 340 },
});
