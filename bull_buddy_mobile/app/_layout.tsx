import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useGameStore } from '../src/store/gameStore';
import { theme } from '../src/constants/theme';

export default function RootLayout() {
  const init = useGameStore(s => s.init);

  useEffect(() => {
    init();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="chat/index"
          options={{
            title: 'Chat con Toro 🐂',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="modal/streak"
          options={{
            title: '🔥 Racha',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="modal/logros"
          options={{
            title: '🏆 Logros',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="modal/tienda"
          options={{
            title: '🛒 Tienda',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="modal/ranking"
          options={{
            title: '🏅 Ranking',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="modal/ajustes"
          options={{
            title: '⚙️ Ajustes',
            presentation: 'modal',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
