import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Typography, SurfaceStyles } from '../constants/theme';

type Props = Pick<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'onFocus' | 'onBlur'> & {
  onSubmit: () => void;
  voice?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  submitLabel?: string;
};

/** Camada visual do onboarding; cada fluxo mantém seus handlers de voz e envio. */
export function MessageComposer({ value, onChangeText, placeholder, onFocus, onBlur, onSubmit, voice, disabled = false, loading = false, submitLabel = 'Enviar mensagem' }: Props) {
  const [focused, setFocused] = useState(false);
  const blocked = disabled || loading;
  const cannotSend = blocked || !value?.trim();
  return <View style={s.row}>
    <View style={[s.inputWrapper, focused && s.focused, blocked && s.disabled]}>
      <TextInput style={s.input} value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor={Colors.composerPlaceholder}
        accessibilityLabel={placeholder || 'Mensagem'} editable={!blocked}
        onFocus={event => { setFocused(true); onFocus?.(event); }}
        onBlur={event => { setFocused(false); onBlur?.(event); }}
        onSubmitEditing={onSubmit} returnKeyType="send" multiline scrollEnabled />
      {voice ? <><View style={s.divider} />{voice}</> : null}
    </View>
    <TouchableOpacity style={[s.send, cannotSend && s.sendDisabled]} onPress={onSubmit}
      hitSlop={1}
      disabled={cannotSend} activeOpacity={0.8} accessibilityRole="button"
      accessibilityLabel={submitLabel} accessibilityState={{ disabled: !!cannotSend, busy: loading }}>
      {loading ? <ActivityIndicator color={Colors.bgCard} size="small" /> : <Ionicons name="arrow-up" size={21} color={Colors.bgCard} />}
    </TouchableOpacity>
  </View>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  inputWrapper: {
      ...SurfaceStyles.control,
    flex: 1, minWidth: 0, minHeight: 46, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 5, borderRadius: Radius.full },
  focused: {
      ...SurfaceStyles.controlFocus
},
  disabled: { ...SurfaceStyles.controlDisabled, opacity: 0.65 },
  input: { flex: 1, minWidth: 0, maxHeight: 68, minHeight: 42, lineHeight: 20, paddingVertical: 9, textAlignVertical: 'center', fontFamily: Typography.regular, fontSize: 14, color: Colors.ink },
  divider: { width: 1, height: 20, backgroundColor: Colors.composerDivider, marginHorizontal: 9 },
  send: {
      ...SurfaceStyles.floating,
    width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: {
      ...SurfaceStyles.actionDisabled
},
});
