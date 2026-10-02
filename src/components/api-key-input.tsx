import { useRef } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

const MASK = '•';

/** Reconcile an edit of the masked display without sending the secret to Android. */
export function applyMaskedEdit(value: string, text: string, selection: { start: number; end: number }) {
  const first = text.split('').findIndex(char => char !== MASK);
  if (first >= 0) {
    let end = text.length;
    while (end > first && text[end - 1] === MASK) end--;
    const suffix = text.length - end;
    return value.slice(0, first) + text.slice(first, end) + (suffix ? value.slice(-suffix) : '');
  }
  const removed = value.length - text.length;
  if (removed <= 0) return value;
  const end = Math.min(value.length, selection.end);
  const start = Math.max(0, end - removed);
  return value.slice(0, start) + value.slice(end);
}

type Props = Omit<TextInputProps, 'value' | 'onChangeText' | 'secureTextEntry'> & {
  value: string;
  onChangeText: (value: string) => void;
};

/** Android receives bullets as ordinary text, never a password input or the key. */
export default function ApiKeyInput({ value, onChangeText, ...props }: Props) {
  const selection = useRef({ start: value.length, end: value.length });
  const android = Platform.OS === 'android';
  const input = <TextInput
    {...props}
    value={android ? MASK.repeat(value.length) : value}
    onChangeText={text => onChangeText(android ? applyMaskedEdit(value, text, selection.current) : text)}
    onSelectionChange={event => { selection.current = event.nativeEvent.selection; }}
    secureTextEntry={!android}
    autoComplete={Platform.OS === 'ios' ? undefined : 'off'}
    textContentType={Platform.OS === 'ios' ? 'none' : undefined}
    importantForAutofill="noExcludeDescendants"
    autoCorrect={false}
    spellCheck={false}
    autoCapitalize="none"
    keyboardType="default"
    style={[props.style, android && { color: 'transparent' }]}
    cursorColor={props.cursorColor ?? StyleSheet.flatten(props.style)?.color}
  />;
  if (!android) return input;
  // Hide native edits too: a paste must never flash its plaintext before React updates.
  return <View style={{ position: 'relative' }}>
    {input}
    {!!value && <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Text numberOfLines={1} ellipsizeMode="head" style={[props.style, { flex: 1, borderWidth: 0, backgroundColor: 'transparent', textAlignVertical: 'center' }]}>{MASK.repeat(value.length)}</Text>
    </View>}
  </View>;
}
