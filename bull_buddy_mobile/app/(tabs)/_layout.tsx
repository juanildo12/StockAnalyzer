import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity } from 'react-native';
import { useGameStore } from '../../src/store/gameStore';
import { theme } from '../../src/constants/theme';
import { AppOverlay } from '../../src/components/AppOverlay';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', opacity: focused ? 1 : 0.5 }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
    </View>
  );
}

export default function TabLayout() {
  const level = useGameStore(s => s.level);

  return (
    <>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '700' },
          tabBarStyle: {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            paddingBottom: 8,
            paddingTop: 8,
            height: 64,
          },
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textSecondary,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Inicio',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="simulador"
          options={{
            title: 'Simulador',
            tabBarIcon: ({ focused }) => <TabIcon emoji="📈" focused={focused} />,
            headerRight: () => (
              <View style={{ flexDirection: 'row', gap: 8, marginRight: 16, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => {}}>
                  <Text style={{ fontSize: 20 }}>🐂</Text>
                </TouchableOpacity>
                <View style={{ backgroundColor: theme.primary + '30', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                  <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>Nv.{level}</Text>
                </View>
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="aprende"
          options={{
            title: 'Aprende',
            tabBarIcon: ({ focused }) => <TabIcon emoji="📚" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
          }}
        />
      </Tabs>
      <AppOverlay />
    </>
  );
}
