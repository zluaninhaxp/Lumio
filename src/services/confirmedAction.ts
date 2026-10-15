import { businessStateService, businessSyncStatus } from './businessStateService';
import { AppAlert } from './appAlert';
import { isRejectedValidation } from './persistenceErrors';
import type { Snapshot } from './syncMerge';
const attempts = new Map<string, { finish: (() => void) | null; busy: boolean; scope: string; preparation?: { before: Snapshot; after: Snapshot } }>();

businessSyncStatus.subscribe(state => {
  if (state.status !== 'ready') return;
  for (const [id, attempt] of attempts) {
    if (attempt.busy) continue;
    attempts.delete(id);
    if (attempt.scope === businessStateService.scope()) attempt.finish?.();
  }
});

/** Confirmation boundary for row actions, toggles and navigation without an editable form. */
export async function confirmAction(key: string, prepare: () => (() => void) | undefined) {
  const scope = businessStateService.scope();
  const id = scope + ':' + key;
  let attempt = attempts.get(id);
  if (attempt?.busy) return;
  if (!attempt) { attempt = { finish: null, busy: false, scope }; attempts.set(id, attempt); }
  attempt.busy = true;
  try {
    if (!businessStateService.isStarted()) throw new Error('Aguarde o carregamento da conta.');
    if (!attempt.finish) {
      const before = businessStateService.capturePreparation();
      businessStateService.holdChanges();
      try {
        attempt.finish = prepare() ?? (() => {});
        attempt.preparation = { before, after: businessStateService.capturePreparation() };
      } catch (error) {
        businessStateService.cancelRejectedPreparation(before, businessStateService.capturePreparation());
        attempts.delete(id);
        throw error;
      } finally { businessStateService.releaseChanges(); }
    }
    if (!attempt.finish) { attempts.delete(id); return; }
    await businessStateService.commit();
    if (scope !== businessStateService.scope()) throw new Error('A conta foi alterada.');
    attempts.delete(id);
    attempt.finish();
  } catch (error) {
    if (isRejectedValidation(error) && attempt.preparation && scope === businessStateService.scope()) {
      if (businessStateService.cancelRejectedPreparation(attempt.preparation.before, attempt.preparation.after)) attempts.delete(id);
    }
    AppAlert.alert('Alteração não confirmada', error instanceof Error ? error.message : 'Tente novamente com internet. Seu rascunho foi preservado.', undefined, { variant: 'warning' });
  } finally { attempt.busy = false; }
}
