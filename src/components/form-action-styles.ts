import { StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, SurfaceStyles, FontSize, Typography } from '../constants/theme';

/** Shared dimensions and states; each form keeps its existing footer layout. */
export const FormActionStyles = StyleSheet.create({
  primary: {
    flex: 1, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, backgroundColor: Colors.actionBackground,
    alignItems: 'center', justifyContent: 'center',
  },
  secondary: {
    ...SurfaceStyles.filter,
    flex: 1, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center',
  },
  primaryText: { fontFamily: Typography.semibold, fontSize: FontSize.sm, color: Colors.onAction },
  secondaryText: { fontFamily: Typography.medium, fontSize: FontSize.sm, color: Colors.textSecondary },
  disabled: { ...SurfaceStyles.actionDisabled, opacity: 0.5 },
  secondaryDisabled: { opacity: 0.5 },
});
