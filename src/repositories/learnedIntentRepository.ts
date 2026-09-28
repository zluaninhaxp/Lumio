import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { LearnedIntentMarker } from '../engine/taxonomy/types';

export const learnedIntentRepository = {
  async getAll(userId: string): Promise<LearnedIntentMarker[]> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');
    if (isSupabaseConfigured) {
      const { data, error } = await supabase!.from('learned_intent_markers').select('phrase, domain, resolution, occurrences, last_seen_at').eq('user_id', userId);
      if (error) throw new Error(error.message);
      return (data ?? []).map((item) => ({ phrase: item.phrase, domain: item.domain, resolution: item.resolution, occurrences: item.occurrences, lastSeenAt: item.last_seen_at }));
    }
    throw new Error('Supabase não configurado.');
  },

  async save(userId: string, markers: LearnedIntentMarker[]): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');
    if (isSupabaseConfigured) {
      const { error } = await supabase!.from('learned_intent_markers').upsert(markers.map((marker) => ({ user_id: userId, phrase: marker.phrase, domain: marker.domain, resolution: marker.resolution, occurrences: marker.occurrences, last_seen_at: marker.lastSeenAt })), { onConflict: 'user_id,domain,phrase' });
      if (error) throw new Error(error.message);
      return;
    }
  },

  async clear(userId: string): Promise<void> {
    if (!isSupabaseConfigured) throw new Error('Supabase não configurado.');
    if (isSupabaseConfigured) {
      const { error } = await supabase!.from('learned_intent_markers').delete().eq('user_id', userId);
      if (error) throw new Error(error.message);
      return;
    }
  },
};
