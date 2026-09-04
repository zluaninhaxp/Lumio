import { storageService } from '../services/storageService';
import { StorageKeys } from '../constants/storageKeys';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { LearnedIntentMarker } from '../engine/taxonomy/types';

function keyFor(userId: string): string {
  return `${StorageKeys.LEARNED_INTENTS_PREFIX}${userId}`;
}

export const learnedIntentRepository = {
  async getAll(userId: string): Promise<LearnedIntentMarker[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase!.from('learned_intent_markers').select('phrase, domain, resolution, occurrences, last_seen_at').eq('user_id', userId);
      if (!error) return (data ?? []).map((item) => ({ phrase: item.phrase, domain: item.domain, resolution: item.resolution, occurrences: item.occurrences, lastSeenAt: item.last_seen_at }));
    }
    return (await storageService.getItem<LearnedIntentMarker[]>(keyFor(userId))) ?? [];
  },

  async save(userId: string, markers: LearnedIntentMarker[]): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase!.from('learned_intent_markers').upsert(markers.map((marker) => ({ user_id: userId, phrase: marker.phrase, domain: marker.domain, resolution: marker.resolution, occurrences: marker.occurrences, last_seen_at: marker.lastSeenAt })), { onConflict: 'user_id,domain,phrase' });
      if (!error) return;
    }
    await storageService.setItem(keyFor(userId), markers);
  },

  async clear(userId: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase!.from('learned_intent_markers').delete().eq('user_id', userId);
      if (!error) return;
    }
    await storageService.removeItem(keyFor(userId));
  },
};
