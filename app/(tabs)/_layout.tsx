import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabIcon({ name, focused, label }: { name: any; focused: boolean; label: string }) {
  return (
    <View style={styles.tabItem}>
      <Ionicons
        name={focused ? name : `${name}-outline` as any}
        size={22}
        color={focused ? Colors.accent : Colors.textMuted}
      />
      <Text
        style={[styles.tabLabel, focused && styles.tabLabelActive]}
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 48 + insets.bottom,
            paddingBottom: insets.bottom + 4,
          },
        ],
        tabBarItemStyle: {
          flex: 1,
          minWidth: 0,
          paddingHorizontal: 0,
          transform: [{ translateY: 4 }],
        },
        tabBarIconStyle: {
          flex: 1,
          width: '100%',
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="chatbubble" focused={focused} label="Chat" />
          ),
        }}
      />
      <Tabs.Screen
        name="tarefas"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="checkmark-circle" focused={focused} label="Tarefas" />
          ),
        }}
      />
      <Tabs.Screen
        name="calendario"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="calendar" focused={focused} label="Calendário" />
          ),
        }}
      />
      <Tabs.Screen
        name="financeiro"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="wallet" focused={focused} label="Financeiro" />
          ),
        }}
      />
      <Tabs.Screen
        name="apps"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="apps" focused={focused} label="Apps" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
    paddingTop: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    width: '100%',
    alignSelf: 'stretch',
  },
  tabLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10,
    color: '#AAAAAA',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#00A878',
  },
});
