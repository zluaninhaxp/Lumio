import { storageService } from './storageService';
import { StorageKeys } from '../constants/storageKeys';
import type { User } from '../types/user';
import type { LearnedIntentMarker } from '../engine/taxonomy/types';
import { onboardingRepository, type OnboardingRecord } from '../repositories/onboardingRepository';
import { learnedIntentRepository } from '../repositories/learnedIntentRepository';
import { equivalentJson, migrateOnce } from './legacyMigrationCore';

function validRecord(value: unknown): value is OnboardingRecord {
  return !!value && typeof value === 'object' &&
    !!(value as OnboardingRecord).responses &&
    typeof (value as OnboardingRecord).responses === 'object' && !Array.isArray((value as OnboardingRecord).responses);
}
function validMarkers(value: unknown): value is LearnedIntentMarker[] {
  return Array.isArray(value) && value.every((marker) => marker && typeof marker.phrase === 'string' &&
    typeof marker.resolution === 'string' && ['task', 'calendar', 'financial'].includes(marker.domain) &&
    Number.isInteger(marker.occurrences) && marker.occurrences > 0);
}
function markerId(marker: LearnedIntentMarker) { return `${marker.domain}\u0000${marker.phrase}`; }

/** Reads legacy keys only. Removal follows a verified remote read. */
export const legacyMigrationService = {
  async migrate(remoteId: string, email: string, password?: string): Promise<void> {
    const legacyUsers = await storageService.getItem<User[]>(StorageKeys.USERS);
    const matching = Array.isArray(legacyUsers) && password
      ? legacyUsers.find((user) => user.email?.toLowerCase() === email.toLowerCase() && user.password === password)
      : null;
    if (Array.isArray(legacyUsers) && legacyUsers.some((user) => user.email?.toLowerCase() === email.toLowerCase()) && !matching) {
      throw new Error('Dados locais antigos não puderam ser vinculados a esta sessão. Eles foram preservados.');
    }
    const legacyId = matching?.id ?? remoteId;
    const onboardingKey = `${StorageKeys.ONBOARDING_PREFIX}${legacyId}`;
    const markerKey = `${StorageKeys.LEARNED_INTENTS_PREFIX}${legacyId}`;

    const localOnboarding = await storageService.getItem<unknown>(onboardingKey);
    if (localOnboarding !== null) {
      if (!validRecord(localOnboarding)) throw new Error('Dados antigos de onboarding inválidos. A cópia local foi preservada.');
      const expected = { ...localOnboarding, responses: {
        ...(localOnboarding.responses as Record<string, unknown>),
        ...(Array.isArray(localOnboarding.pluginOrder) ? { __lumioPluginOrder: localOnboarding.pluginOrder } : {}),
      } };
      await migrateOnce({
        legacy: expected,
        readRemote: () => onboardingRepository.get(remoteId),
        writeRemote: async (record) => { await onboardingRepository.save(remoteId, {
          responses: record.responses,
          context: record.context,
          structuredProfile: record.structuredProfile,
          activatedPlugins: Array.isArray(record.activatedPlugins) ? record.activatedPlugins : [],
          pluginOrder: Array.isArray(record.pluginOrder) ? record.pluginOrder : undefined,
        }); },
        equivalent: (remote, legacy) => equivalentJson(remote.responses, legacy.responses),
        removeLegacy: () => storageService.removeItem(onboardingKey),
      });
    }

    const localMarkers = await storageService.getItem<unknown>(markerKey);
    if (localMarkers !== null) {
      if (!validMarkers(localMarkers)) throw new Error('Marcadores antigos inválidos. A cópia local foi preservada.');
      const remote = await learnedIntentRepository.getAll(remoteId);
      const existing = new Set(remote.map(markerId));
      const missing = localMarkers.filter((marker) => !existing.has(markerId(marker)));
      if (missing.length) await learnedIntentRepository.save(remoteId, missing);
      const confirmed = await learnedIntentRepository.getAll(remoteId);
      const persisted = new Set(confirmed.map(markerId));
      if (!localMarkers.every((marker) => persisted.has(markerId(marker)))) {
        throw new Error('Não foi possível confirmar a migração dos marcadores.');
      }
      await storageService.removeItem(markerKey);
    }
    if (matching && Array.isArray(legacyUsers)) {
      const remaining = legacyUsers.filter((user) => user.id !== matching.id);
      // Cleanup of old plaintext credentials, never a new account write.
      if (remaining.length) await storageService.setItem(StorageKeys.USERS, remaining);
      else await storageService.removeItem(StorageKeys.USERS);
      await storageService.removeItem(StorageKeys.SESSION);
    }
  },
};
