/** Confirmation-first, retryable migration of one legacy record. */
export async function migrateOnce<T>(options: {
  legacy: T | null;
  readRemote: () => Promise<T | null>;
  writeRemote: (value: T) => Promise<void>;
  equivalent: (remote: T, legacy: T) => boolean;
  removeLegacy: () => Promise<void>;
}): Promise<void> {
  if (options.legacy === null) return;
  const existing = await options.readRemote();
  if (existing !== null && !options.equivalent(existing, options.legacy)) {
    throw new Error('Os dados antigos e remotos são diferentes; migração manual necessária.');
  }
  if (existing === null) await options.writeRemote(options.legacy);
  const confirmed = await options.readRemote();
  if (confirmed === null || !options.equivalent(confirmed, options.legacy)) {
    throw new Error('Persistência remota não confirmada.');
  }
  await options.removeLegacy();
}

export function equivalentJson(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)]));
    }
    return value;
  };
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
