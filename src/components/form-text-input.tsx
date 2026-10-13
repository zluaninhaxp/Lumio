import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, type StyleProp, type TextStyle } from 'react-native';
import { SurfaceColors, SurfaceStyles } from '../constants/theme';

type Props = TextInputProps & { focusStyle?: StyleProp<TextStyle> };

/** Adds focus feedback without wrapping the native input or changing its events/ref. */
export const FormTextInput = forwardRef<TextInput, Props>(function FormTextInput(
  { style, focusStyle = SurfaceStyles.controlFocus, onFocus, onBlur, editable, ...props }, ref,
) {
  const [focused, setFocused] = useState(false);
  const hasError = StyleSheet.flatten(style)?.borderColor === SurfaceColors.errorBorder;
  return <TextInput {...props} ref={ref} editable={editable}
    style={[style, focused && editable !== false && !hasError && focusStyle]}
    onFocus={event => { setFocused(true); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }} />;
});
