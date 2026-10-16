import { useEffect, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { usePathname } from 'expo-router';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { KeyboardAvoidingView, KeyboardProvider, useKeyboardController, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

export function ChatKeyboardLayout({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'android') return <>{children}</>;
  // The provider must surround both scene and tab bar so there is one native
  // IME timeline. Other routes keep their existing native resize behavior.
  return (
    <KeyboardProvider enabled={false} preserveEdgeToEdge>
      <Viewport>{children}</Viewport>
    </KeyboardProvider>
  );
}

function Viewport({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = Platform.OS === 'android' && pathname === '/chat';
  const { setEnabled } = useKeyboardController();
  useEffect(() => {
    setEnabled(active);
    return () => setEnabled(false);
  }, [active, setEnabled]);
  return <KeyboardAvoidingView enabled={active} behavior="padding" style={{ flex: 1 }}>{children}</KeyboardAvoidingView>;
}

export function ChatTabBar(props: BottomTabBarProps) {
  if (Platform.OS !== 'android') return <BottomTabBar {...props} />;
  return <AndroidChatTabBar {...props} />;
}

function AndroidChatTabBar(props: BottomTabBarProps) {
  const active = props.state.routes[props.state.index].name === 'chat';
  const { progress } = useReanimatedKeyboardAnimation();
  const options = props.descriptors[props.state.routes[props.state.index].key].options;
  // The navigator owns the resting tab height, including the system inset.
  const height = (options.tabBarStyle as { height: number }).height;
  const style = useAnimatedStyle(() => {
    const visible = Math.max(0, Math.min(1, 1 - progress.value));
    return active ? { height: height * visible, opacity: visible, overflow: 'hidden' } : {};
  });
  return (
    <Animated.View style={style}>
      <View style={active ? { height, overflow: 'visible' } : undefined}>
        <BottomTabBar {...props} />
      </View>
    </Animated.View>
  );
}
