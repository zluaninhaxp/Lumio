import { useEffect, useRef, useState } from 'react';
import { businessStateService, businessSyncStatus } from '../services/businessStateService';
import { AppAlert } from '../services/appAlert';
import { isRejectedValidation } from '../services/persistenceErrors';
import type { Snapshot } from '../services/syncMerge';

/** Retain the original operation and ids on failure. Retrying never re-applies stock/accounting effects. */
export function useConfirmedSave() {
  const busy = useRef(false);
  const attemptScope = useRef('');
  const completion = useRef<(() => void) | null>(null);
  const preparation = useRef<{ before: Snapshot; after: Snapshot } | null>(null);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => businessSyncStatus.subscribe(state => {
    if (state.status !== 'ready' || busy.current || !completion.current) return;
    const finish = completion.current;
    completion.current = null;
    setRetrying(false);
    if (attemptScope.current === businessStateService.scope()) finish();
  }), []);
  async function run(prepare: () => (() => void) | undefined | false) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      if (attemptScope.current !== businessStateService.scope()) completion.current = null;
      if (!completion.current) {
        attemptScope.current = businessStateService.scope();
        if (!businessStateService.isStarted()) throw new Error('Aguarde o carregamento da conta antes de salvar.');
        const before = businessStateService.capturePreparation();
        businessStateService.holdChanges();
        try {
          completion.current = prepare() || null;
          const after = businessStateService.capturePreparation();
          preparation.current = { before, after };
          if (!completion.current) businessStateService.cancelRejectedPreparation(before, after);
        } catch (error) {
          businessStateService.cancelRejectedPreparation(before, businessStateService.capturePreparation());
          throw error;
        } finally { businessStateService.releaseChanges(); }
      }
      if (!completion.current) return;
      await businessStateService.commit();
      if (attemptScope.current !== businessStateService.scope()) {
        completion.current = null;
        setRetrying(false);
        return;
      }
      const finish = completion.current;
      completion.current = null;
      setRetrying(false);
      finish();
    } catch (error) {
      // A definitive SQL validation rejection is safe to revise. Invert only this
      // preparation; preserve subsequent edits and refuse an ambiguous inversion.
      if (isRejectedValidation(error) && preparation.current && attemptScope.current === businessStateService.scope()) {
        const { before, after } = preparation.current;
        if (businessStateService.cancelRejectedPreparation(before, after)) completion.current = null;
      }
      setRetrying(!!completion.current);
      AppAlert.alert('Não foi possível salvar', (error instanceof Error ? error.message : 'Conecte-se à internet e tente novamente.') + (completion.current ? ' Tentar novamente confirma os dados desta tentativa, sem repetir o cadastro.' : ''), undefined, { variant: 'warning' });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return { run, saving, retrying, locked: saving || retrying };
}
