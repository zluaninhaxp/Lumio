export type RelationDraftKind = 'task' | 'calendar';
export type RelationDraftRelation = 'client' | 'supplier' | 'employee';

type Draft = Record<string, unknown>;
const pendingDrafts: Partial<Record<RelationDraftKind, Draft>> = {};

export function saveRelationDraft(kind: RelationDraftKind, draft: object) {
  pendingDrafts[kind] = { ...draft };
}

export function getRelationDraft<T extends object>(kind: RelationDraftKind): T | null {
  return (pendingDrafts[kind] as T | undefined) ?? null;
}

export function setPendingRelation(kind: RelationDraftKind, relation: RelationDraftRelation, id: string) {
  const draft = pendingDrafts[kind];
  if (!draft) return null;
  const updated = { ...draft, [`${relation}Id`]: id };
  pendingDrafts[kind] = updated;
  return updated;
}

export function clearRelationDraft(kind: RelationDraftKind) {
  delete pendingDrafts[kind];
}
