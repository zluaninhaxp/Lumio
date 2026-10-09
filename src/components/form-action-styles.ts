import { StyleSheet } from 'react-native';
import { Colors, FontSize, Radius, Spacing, SurfaceStyles, Typography } from '../constants/theme';

/** Shared dimensions and states; each form keeps its existing footer layout. */
export const FormActionStyles = StyleSheet.create({
  primary: {
    flex: 1, minHeight: 50, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, backgroundColor: Colors.actionBackground,
    alignItems: 'center', justifyContent: 'center',
  },
  secondary: {
    ...SurfaceStyles.filter,
    flex: 1, minHeight: 50, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center',
  },
  primaryText: { fontFamily: Typography.semibold, fontSize: FontSize.md, color: Colors.onAction },
  secondaryText: { fontFamily: Typography.semibold, fontSize: FontSize.md, color: Colors.textSecondary },
  disabled: { ...SurfaceStyles.actionDisabled, opacity: 0.5 },
});
