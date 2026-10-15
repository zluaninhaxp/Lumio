import { protectedStorage } from '../services/protectedStorage';
import { createClient, processLock } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { authFetch } from './authFetch';

// EXPO_PUBLIC_* is inlined by Metro during local development. EAS standalone
// builds also need the values in the embedded app config, otherwise the web
// works but the installed APK silently falls back to local repositories.
const embeddedSupabase = Constants.expoConfig?.extra?.supabase as
  | { url?: string; anonKey?: string }
  | undefined;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? embeddedSupabase?.url;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? embeddedSupabase?.anonKey;

let configuredUrl: URL | null = null;
try { if (supabaseUrl) configuredUrl = new URL(supabaseUrl); } catch { /* Show a recoverable configuration error through AuthProvider. */ }
export const supabaseProjectScope = configuredUrl?.hostname ?? 'unconfigured';

export const isSupabaseConfigured = Boolean(configuredUrl && ['https:', 'http:'].includes(configuredUrl.protocol) && supabaseAnonKey && !supabaseUrl?.includes('seu-projeto'));

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      global: { fetch: authFetch },
      auth: {
        storage: protectedStorage,
        flowType: 'pkce',
        lock: processLock,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
