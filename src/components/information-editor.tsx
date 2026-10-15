import { FormTextInput } from './form-text-input';
import { SheetCloseButton } from './sheet-close-button';
import { FormActionStyles } from './form-action-styles';
import { forwardRef, useRef, useImperativeHandle, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions, type TextInputProps } from 'react-native';
import { ModalScrollView } from './modal-scroll-view';
import { BottomSheet, type BottomSheetHandle } from './Calendar/BottomSheet';
import { FormLabel } from './RequiredLabel';
import { ControlOpacity, Colors, FontSize, Radius, Spacing, Typography, SurfaceStyles, TextStyles, nativeTextStyle } from '../constants/theme';
import { LoadingSpinner } from "./loading-spinner";

export function EditorField({ label, ...props }: TextInputProps & { label: string; }) {
  return <><FormLabel>{label}</FormLabel><FormTextInput style={styles.input} placeholderTextColor={Colors.placeholder} accessibilityLabel={label} {...props} /></>;
}
export function BusinessIdentityFields({ name, segment, onNameChange, onSegmentChange }: { name: string; segment: string; onNameChange: (value: string) => void; onSegmentChange: (value: string) => void; }) {
  return <><EditorField label="Nome do negócio" value={name} onChangeText={onNameChange} placeholder="Nome do negócio" maxLength={100} /><EditorField label="Segmento" value={segment} onChangeText={onSegmentChange} placeholder="Segmento" maxLength={120} /></>;
}
export const InformationEditor = forwardRef<BottomSheetHandle, { visible: boolean; draft?: unknown; onClose: () => void; title: string; saving: boolean; error: string; onSave: () => void; saveLabel?: string; destructive?: boolean; children: ReactNode; }>(function InformationEditor({ visible, draft, onClose, title, saving, error, onSave, saveLabel = 'Salvar', destructive = false, children }, ref) {
  const sheetRef = useRef<BottomSheetHandle>(null);
  const { height: screenHeight } = useWindowDimensions();
  const close = () => { if (!saving) sheetRef.current?.requestClose(); };
  useImperativeHandle(ref, () => ({ close: () => sheetRef.current?.close(), requestClose: () => sheetRef.current?.requestClose() }));
  return <BottomSheet ref={sheetRef} draft={draft} visible={visible} onClose={onClose} dismissible={!saving} height={screenHeight} maxHeight={Math.min(screenHeight * 0.9, 720)}>
    <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{title}</Text><SheetCloseButton onPress={close} disabled={saving} label="Fechar edição" /></View>
    <ModalScrollView style={[styles.formScroll, { maxHeight: Math.max(120, Math.min(screenHeight * 0.9, 720) - 124) }]} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
      {children}
      {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      <View style={styles.modalActions}><TouchableOpacity activeOpacity={ControlOpacity.pressed} style={[styles.cancelButton, saving && FormActionStyles.secondaryDisabled]} onPress={() => close()} disabled={saving} accessibilityRole="button"><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity><TouchableOpacity activeOpacity={ControlOpacity.pressed} style={[styles.saveButton, destructive && { backgroundColor: Colors.dangerActionBackground }, saving && styles.saveDisabled]} onPress={onSave} disabled={saving} accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }}><>{saving ? <LoadingSpinner color={Colors.onAction} /> : <Text style={styles.saveText}>{saveLabel}</Text>}</></TouchableOpacity></View>
    </ModalScrollView>
  </BottomSheet>;
});
const styles = StyleSheet.create({
  sheetHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }, sheetTitle: { ...nativeTextStyle(TextStyles.formTitle), flex: 1, },
  formScroll: { flexShrink: 1 }, form: { gap: Spacing.md, paddingBottom: Spacing.xl }, input: { ...nativeTextStyle(TextStyles.body),
    ...SurfaceStyles.control,
    minHeight: 48, borderRadius: Radius.md, padding: Spacing.lg, }, error: { fontFamily: Typography.medium, fontSize: FontSize.sm, color: Colors.dangerText },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm }, cancelButton: FormActionStyles.secondary, cancelText: FormActionStyles.secondaryText, saveButton: FormActionStyles.primary, saveDisabled: FormActionStyles.disabled, saveText: FormActionStyles.primaryText, });
