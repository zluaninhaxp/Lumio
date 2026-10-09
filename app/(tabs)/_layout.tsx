import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BottomSurface } from '@/src/components/bottom-surface';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography } from '@/src/constants/theme';

const tabs = [
  { name: 'chat', title: 'Chat', icon: 'chatbubble' },
  { name: 'tarefas', title: 'Tarefas', icon: 'checkmark-circle' },
  { name: 'calendario', title: 'Calendário', icon: 'calendar' },
  { name: 'financeiro', title: 'Financeiro', icon: 'wallet' },
  { name: 'apps', title: 'Apps', icon: 'apps' },
] as const;

export default function TabLayout() {
  const { bottom } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const itemHeight = Math.max(56, 34 + 16 * Math.min(fontScale, 2));

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: Colors.bottomSurface },
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: Colors.accentText,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarShowLabel: true,
        tabBarBackground: () => <BottomSurface pointerEvents="none" organicEdge={route.name !== 'chat'} style={StyleSheet.absoluteFillObject} />,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: {
          fontFamily: Typography.semibold,
          fontSize: 11,
          lineHeight: 16,
          textAlign: 'center',
          includeFontPadding: false,
        },
        tabBarIconStyle: { marginTop: Spacing.xs },
        tabBarItemStyle: { minWidth: 0, minHeight: itemHeight },
        tabBarStyle: {
          height: itemHeight + bottom,
          paddingBottom: bottom,
          backgroundColor: Colors.bottomSurface,
          overflow: 'visible',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
      })}
    >
      {tabs.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarAccessibilityLabel: title,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={(focused ? icon : `${icon}-outline`) as any} size={22} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
