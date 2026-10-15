let identity: string | null = null;
const resetters = new Set<() => void>();
export function setDraftIdentity(project: string, userId: string | null) {
  const next = userId ? `${project}/${userId}` : null;
  if (identity === next) return;
  identity = next;
  resetters.forEach(reset => reset());
}
export function draftIdentity() { return identity; }
export function onDraftIdentityChange(reset: () => void) { resetters.add(reset); return () => { resetters.delete(reset); }; }
