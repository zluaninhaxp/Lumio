import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// EXPO_PUBLIC_* is inlined by Metro during local development. EAS standalone
// builds also need the values in the embedded app config, otherwise the web
// works but the installed APK silently falls back to local repositories.
const embeddedSupabase = Constants.expoConfig?.extra?.supabase as
  | { url?: string; anonKey?: string }
  | undefined;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? embeddedSupabase?.url;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? embeddedSupabase?.anonKey;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('seu-projeto'));

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
