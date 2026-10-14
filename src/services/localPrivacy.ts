import AsyncStorage from '@react-native-async-storage/async-storage';
import { protectedStorage } from './protectedStorage';

/** Called only after a confirmed account deletion. Ordinary logout retains pending journals. */
export async function purgeAccountStorage(project: string, userId: string, email?: string) {
  const keys = [
    `@lumio/unsaved/${project}/${userId}`, `@lumio/chat-unsaved/${project}/${userId}`,
    `@lumio/task-suggestions/dismissed/${userId}`, `@lumio/onboarding/${userId}`, `@lumio/learned-intents/${userId}`,
  ];
  for (const key of keys) await protectedStorage.removeItem(key);
  for (const key of await AsyncStorage.getAllKeys()) if (key.startsWith(`@lumio/rejected/${project}/${userId}/`)) await protectedStorage.removeItem(key);
  const raw = await AsyncStorage.getItem('@lumio/users');
  if (raw) {
    const users: unknown = JSON.parse(raw);
    if (!Array.isArray(users)) throw new Error('Dados legados inválidos. Solicite suporte para concluir a limpeza local.');
    const own = users.filter(user => user?.id === userId || (email && user?.email?.toLowerCase() === email.toLowerCase()));
    for (const user of own) for (const prefix of ['@lumio/onboarding/','@lumio/learned-intents/']) await protectedStorage.removeItem(prefix + user.id);
    const remaining = users.filter(user => !own.includes(user));
    if (remaining.length) await AsyncStorage.setItem('@lumio/users', JSON.stringify(remaining));
    else await AsyncStorage.removeItem('@lumio/users');
  }
  await AsyncStorage.removeItem('@lumio/session');
}
