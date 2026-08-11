import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { useEffect } from 'react';
import { useAppStore } from '@/src/store';

export default function RootLayout() {
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const refreshContratos = useAppStore((state) => state.refreshContratos);

  useEffect(() => {
    refreshContratos();
  }, [refreshContratos]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="celebration" />
        <Stack.Screen name="onboarding-summary" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="plugins/store" />
        <Stack.Screen name="plugins/estoque" />
        <Stack.Screen name="plugins/clientes" />
        <Stack.Screen name="plugins/fornecedores" />
        <Stack.Screen name="plugins/vendas" />
        <Stack.Screen name="plugins/orcamentos" />
        <Stack.Screen name="plugins/contratos" />
        <Stack.Screen name="plugins/entregas" />
        <Stack.Screen name="plugins/[id]" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="account" />
        <Stack.Screen name="preferences" />
      </Stack>
    </AuthProvider>
  );
}
