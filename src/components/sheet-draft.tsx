import { createContext, useContext, useLayoutEffect, useRef } from 'react';

export type DraftEntry = { initial: string; current: string };
export const SheetDraftContext = createContext<{
  drafts: Map<object, DraftEntry>;
  requestClose: () => void;
} | null>(null);

/** Register editable values only; expanding a section does not dirty a form. */
export function useSheetDraft(value: unknown, onCancel: () => void) {
  const sheet = useContext(SheetDraftContext);
  const key = useRef({}).current;
  const snapshot = JSON.stringify(value);
  useLayoutEffect(() => {
    if (!sheet) return;
    const previous = sheet.drafts.get(key);
    sheet.drafts.set(key, { initial: previous?.initial ?? snapshot, current: snapshot });
  }, [sheet, key, snapshot]);
  useLayoutEffect(() => () => { sheet?.drafts.delete(key); }, [sheet, key]);
  return sheet?.requestClose ?? onCancel;
}
