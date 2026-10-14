import { Stack } from 'expo-router';
import { Colors } from '@/src/constants/theme';
import { SystemBars } from '@/src/components/system-bars';
import { AppAlertHost } from '@/src/components/app-alert-host';
import { AppFeedbackHost } from '@/src/components/app-feedback';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider } from '@/src/contexts/AuthContext';
import { useEffect } from 'react';
import { useAppStore } from '@/src/store';
import { PersistenceFeedback } from '@/src/components/persistence-feedback';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

// Keep the native launch screen until fonts, session and destination are ready.
void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const refreshContratos = useAppStore((state) => state.refreshContratos);
  const migrateCatalogItems = useAppStore((state) => state.migrateCatalogItems);


  useEffect(() => {
    refreshContratos();
    migrateCatalogItems();
  }, [refreshContratos, migrateCatalogItems]);

  if (!loaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <AuthProvider>
          <SystemBars />
          <PersistenceFeedback>
          <Stack screenOptions={({ route }) => ({ headerShown: false, contentStyle: { backgroundColor: ['index', 'welcome', 'auth', 'login', 'register', 'onboarding', 'celebration', 'onboarding-report-intro', 'onboarding-summary'].includes(route.name) ? Colors.bg : Colors.appBackground } })}>
            <Stack.Screen name="index" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="auth" options={{ animation: 'none' }} />
            <Stack.Screen name="login" options={{ animation: 'fade' }} />
            <Stack.Screen name="register" options={{ animation: 'fade' }} />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="celebration" options={{ gestureEnabled: false }} />
            <Stack.Screen name="onboarding-report-intro" options={{ gestureEnabled: false }} />
            <Stack.Screen name="onboarding-summary" options={{ gestureEnabled: false }} />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="plugins/store" />
            <Stack.Screen name="plugins/estoque" />
            <Stack.Screen name="plugins/catalogo" />
            <Stack.Screen name="plugins/clientes" />
            <Stack.Screen name="plugins/fornecedores" />
            <Stack.Screen name="plugins/vendas" />
            <Stack.Screen name="plugins/orcamentos" />
            <Stack.Screen name="plugins/contratos" />
            <Stack.Screen name="plugins/entregas" />
            <Stack.Screen name="plugins/[id]" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="resources" />
            <Stack.Screen name="account" />
            <Stack.Screen name="preferences" />
            <Stack.Screen name="ai-settings" />
          </Stack>
          </PersistenceFeedback>
          <AppAlertHost />
          <AppFeedbackHost />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
