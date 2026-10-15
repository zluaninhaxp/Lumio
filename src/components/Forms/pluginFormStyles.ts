import { StyleSheet } from 'react-native';
import {
  Colors,
  Radius,
  Spacing, SurfaceStyles, TextStyles, nativeTextStyle } from "../../constants/theme";
import { taskFormStyles } from "../Tasks/taskFormStyles";

// Shared visual language for CRUD forms opened from plugin screens.
const choiceStyles = StyleSheet.create({
  chip: { ...SurfaceStyles.filter,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full
  },
  chipActive: { backgroundColor: Colors.actionBackground, borderColor: Colors.accentIcon },
  chipText: nativeTextStyle(TextStyles.caption),
  chipTextActive: { color: "#FFFFFF" }
});

export const pluginFormStyles = StyleSheet.create({
  ...taskFormStyles,
  modalOverlay: {
    width: "100%" as const,
  },
  overlay: {
    width: "100%" as const,
  },
  modalCard: {
    width: "100%" as const,
    maxHeight: "100%" as const,
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
    gap: Spacing.xs,
    flexShrink: 1,
  },
  modal: {
    width: "100%" as const,
    maxHeight: "100%" as const,
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
    gap: Spacing.xs,
    flexShrink: 1,
  },
  modalTitle: taskFormStyles.title,
  fieldLabel: taskFormStyles.label,
  modalActions: taskFormStyles.actions,
  modalCancel: taskFormStyles.cancelBtn,
  cancel: taskFormStyles.cancelBtn,
  cancelButton: taskFormStyles.cancelBtn,
  cancelButtonText: taskFormStyles.cancelBtnText,
  modalCancelText: taskFormStyles.cancelBtnText,
  cancelText: taskFormStyles.cancelBtnText,
  modalConfirm: taskFormStyles.saveBtn,
  saveButton: taskFormStyles.saveBtn,
  modalConfirmText: taskFormStyles.saveBtnText,
  saveText: taskFormStyles.saveBtnText,
  confirm: taskFormStyles.saveBtn,
  confirmText: taskFormStyles.saveBtnText,
  ...choiceStyles,
  selectChip: choiceStyles.chip,
  selectChipActive: choiceStyles.chipActive,
  selectChipText: choiceStyles.chipText,
  selectChipTextActive: choiceStyles.chipTextActive,
});
