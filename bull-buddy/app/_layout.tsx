import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import { useFonts, Baloo2_400Regular, Baloo2_700Bold } from '@expo-google-fonts/baloo-2';
import { Quicksand_400Regular, Quicksand_500Medium, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import * as SplashScreen from 'expo-splash-screen';
import AppOverlay from '../src/components/AppOverlay';
import { colors } from '../src/constants/theme';
import { initSoundManager } from '../src/services/soundManager';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Baloo2_400Regular,
    Baloo2_700Bold,
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      initSoundManager();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.purple} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal/streak" options={{ presentation: 'modal', headerShown: true, headerTitle: 'Racha Diaria', headerStyle: { backgroundColor: '#FFF6E5' }, headerTintColor: '#2B2A4C' }} />
        <Stack.Screen name="modal/logros" options={{ presentation: 'modal', headerShown: true, headerTitle: 'Logros', headerStyle: { backgroundColor: '#FFF6E5' }, headerTintColor: '#2B2A4C' }} />
        <Stack.Screen name="modal/tienda" options={{ presentation: 'modal', headerShown: true, headerTitle: 'Tienda', headerStyle: { backgroundColor: '#FFF6E5' }, headerTintColor: '#2B2A4C' }} />
        <Stack.Screen name="modal/ranking" options={{ presentation: 'modal', headerShown: true, headerTitle: 'Ranking', headerStyle: { backgroundColor: '#FFF6E5' }, headerTintColor: '#2B2A4C' }} />
        <Stack.Screen name="modal/amigos" options={{ presentation: 'modal', headerShown: true, headerTitle: 'Amigos y Retos', headerStyle: { backgroundColor: '#FFF6E5' }, headerTintColor: '#2B2A4C' }} />
        <Stack.Screen name="modal/eventos" options={{ presentation: 'modal', headerShown: true, headerTitle: 'Eventos', headerStyle: { backgroundColor: '#FFF6E5' }, headerTintColor: '#2B2A4C' }} />
        <Stack.Screen name="modal/ajustes" options={{ presentation: 'modal', headerShown: true, headerTitle: 'Ajustes', headerStyle: { backgroundColor: '#FFF6E5' }, headerTintColor: '#2B2A4C' }} />
        <Stack.Screen name="chat/index" options={{ headerShown: true, headerTitle: 'Chatea con Toro', headerStyle: { backgroundColor: '#FFF6E5' }, headerTintColor: '#2B2A4C' }} />
      </Stack>
      <AppOverlay />
    </View>
  );
}
