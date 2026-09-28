import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Delete only known legacy secrets. Never read or associate them with an account.
// Supabase's persisted authentication session is kept intact.
export async function clearLegacyAiKey(): Promise<void> {
  await AsyncStorage.removeItem('@lumio/ai-api-key-fallback');
  if (await SecureStore.isAvailableAsync()) {
    await SecureStore.deleteItemAsync('@lumio/ai-api-key', {
      keychainService: 'lumio-ai', keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
  }
}
