import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/theme';

function TabIcon({ name, focused, label }: { name: any; focused: boolean; label: string }) {
  return (
    <View style={styles.tabItem}>
      <Ionicons
        name={focused ? name : `${name}-outline` as any}
        size={22}
        color={focused ? Colors.accent : Colors.textMuted}
      />
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
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
        name="painel"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="grid" focused={focused} label="Painel" />
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
    borderTopWidth: 1,
    borderTopColor: '#E5E5E3',
    height: 72,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabItem: {
    alignItems: 'center',
    gap: 4,
  },
  tabLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10,
    color: '#AAAAAA',
  },
  tabLabelActive: {
    color: '#00A878',
  },
});
