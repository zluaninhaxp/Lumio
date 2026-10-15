import { FormActionStyles } from '../form-action-styles';
import { Radius, Spacing, SurfaceStyles, TextStyles, nativeTextStyle } from '../../constants/theme';

export const taskFormStyles = {
  container: { gap: 4, paddingBottom: Spacing.xs },
  title: { ...nativeTextStyle(TextStyles.formTitle), marginBottom: 2 },
  label: { ...nativeTextStyle(TextStyles.label), marginTop: 2 },
  input: {
    ...nativeTextStyle(TextStyles.body),
    ...SurfaceStyles.control,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cancelBtn: FormActionStyles.secondary,
  cancelBtnText: FormActionStyles.secondaryText,
  saveBtn: FormActionStyles.primary,
  saveBtnDisabled: FormActionStyles.disabled,
  saveBtnText: FormActionStyles.primaryText,
};
