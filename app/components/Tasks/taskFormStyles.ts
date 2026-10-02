import { Colors, FontSize, Radius, Spacing, SurfaceStyles } from '../../../src/constants/theme';

export const taskFormStyles = {
  container: { gap: 4, paddingBottom: Spacing.xs },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: FontSize.xl,
    color: Colors.primary,
    marginBottom: 2,
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  input: {
      ...SurfaceStyles.control,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: FontSize.md,
    color: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm
  },
  actions: {
    flexDirection: 'row' as const,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cancelBtn: {
      ...SurfaceStyles.filter,
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center' as const,
  },
  cancelBtnText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center' as const,
  },
  saveBtnDisabled: {
      ...SurfaceStyles.actionDisabled,
    opacity: 0.5 },
  saveBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: FontSize.sm,
    color: '#FFF',
  },
};
