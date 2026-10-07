import { forwardRef, useRef, useImperativeHandle, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet, type BottomSheetHandle } from '../../app/components/Calendar/BottomSheet';
import { FormLabel } from '../../app/components/RequiredLabel';
import { Colors, FontSize, Radius, Spacing, Typography, SurfaceStyles } from '../constants/theme';
export function EditorField({ label, ...props }: TextInputProps & { label: string; }) {
  return <><FormLabel>{label}</FormLabel><TextInput style={styles.input} placeholderTextColor={Colors.textMuted} accessibilityLabel={label} {...props} /></>;
}
export function BusinessIdentityFields({ name, segment, onNameChange, onSegmentChange }: { name: string; segment: string; onNameChange: (value: string) => void; onSegmentChange: (value: string) => void; }) {
  return <><EditorField label="Nome do negócio" value={name} onChangeText={onNameChange} placeholder="Nome do negócio" maxLength={100} /><EditorField label="Segmento" value={segment} onChangeText={onSegmentChange} placeholder="Segmento" maxLength={120} /></>;
}
export const InformationEditor = forwardRef<BottomSheetHandle, { visible: boolean; onClose: () => void; title: string; saving: boolean; error: string; onSave: () => void; saveLabel?: string; destructive?: boolean; children: ReactNode; }>(function InformationEditor({ visible, onClose, title, saving, error, onSave, saveLabel = 'Salvar', destructive = false, children }, ref) {
  const sheetRef = useRef<BottomSheetHandle>(null);
  const { height: screenHeight } = useWindowDimensions();
  const close = () => { if (!saving) sheetRef.current?.close(); };
  useImperativeHandle(ref, () => ({ close: () => sheetRef.current?.close() }));
  return <BottomSheet ref={sheetRef} visible={visible} onClose={onClose} dismissible={!saving} height={screenHeight} maxHeight={Math.min(screenHeight * 0.9, 720)}>
    <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{title}</Text><TouchableOpacity onPress={() => close()} disabled={saving} accessibilityRole="button" accessibilityLabel="Fechar edição" style={styles.closeButton}><Ionicons name="close" size={20} color={Colors.textSecondary} /></TouchableOpacity></View>
    <ScrollView style={[styles.formScroll, { maxHeight: Math.max(120, Math.min(screenHeight * 0.9, 720) - 124) }]} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
      {children}
      {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      <View style={styles.modalActions}><TouchableOpacity style={styles.cancelButton} onPress={() => close()} disabled={saving} accessibilityRole="button"><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity><TouchableOpacity style={[styles.saveButton, destructive && { backgroundColor: Colors.danger }, saving && styles.saveDisabled]} onPress={onSave} disabled={saving} accessibilityRole="button"><Text style={styles.saveText}>{saving ? 'Salvando...' : saveLabel}</Text></TouchableOpacity></View>
    </ScrollView>
  </BottomSheet>;
});
const styles = StyleSheet.create({
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }, sheetTitle: { flex: 1, fontFamily: Typography.bold, fontSize: FontSize.xl, color: Colors.primary }, closeButton: {
    ...SurfaceStyles.filter,
    width: 34, height: 34, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center'
  },
  formScroll: {}, form: { gap: Spacing.md, paddingBottom: Spacing.xl }, input: {
    ...SurfaceStyles.control,
    minHeight: 48, borderRadius: Radius.md, padding: Spacing.lg, fontFamily: Typography.regular, fontSize: FontSize.md, color: Colors.primary
  }, error: { fontFamily: Typography.medium, fontSize: FontSize.sm, color: Colors.danger },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm }, cancelButton: {
    ...SurfaceStyles.filter,
    flex: 1, minHeight: 50, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center'
  }, cancelText: { fontFamily: Typography.semibold, fontSize: FontSize.md, color: Colors.textSecondary }, saveButton: { flex: 1, minHeight: 50, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' }, saveDisabled: { opacity: 0.55 }, saveText: { fontFamily: Typography.semibold, fontSize: FontSize.md, color: Colors.bgCard },
});
