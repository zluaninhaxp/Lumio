import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { KeyboardAvoidingView, KeyboardProvider } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Put inside a native Modal: each modal has a separate window and viewport. */
export function ModalKeyboardViewport({ children, onHeightChange }: { children: ReactNode; onHeightChange?: (height: number) => void }) {
  const insets = useSafeAreaInsets();
  return <KeyboardProvider>
    {/* These legacy modal windows start below the Android status bar. */}
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={Platform.OS === 'android' ? insets.top : 0} style={{ flex: 1 }}>
      <View style={{ flex: 1 }} onLayout={event => onHeightChange?.(event.nativeEvent.layout.height)}>{children}</View>
    </KeyboardAvoidingView>
  </KeyboardProvider>;
}
