import { setDraftIdentity } from './accountScope';
import { changedSnapshotPaths } from './syncMerge';
import { isRejectedValidation } from './persistenceErrors';
import { assertBusinessSnapshot } from './snapshotValidation';
import { PersistenceError } from './persistenceErrors';
import { chatHistoryService } from './chatHistoryService';
import { protectedStorage as AsyncStorage } from './protectedStorage';
import { mergeSnapshots, snapshotsEqual, conflictGroup, resolveWithRemote, type ConflictChoice } from './syncMerge';
import { isSupabaseConfigured, supabase, supabaseProjectScope } from '../lib/supabase';
import { useAppStore, type AppStore } from '../store';
import type { PluginId } from '../plugins/registry';

const collections = {
  clienteItems: 'clients', fornecedorItems: 'suppliers', employeeItems: 'employees',
  estoqueItems: 'stock_items', catalogItems: 'catalog_items', pedidos: 'orders',
  orcamentos: 'quotes', contratos: 'contracts', tasks: 'tasks', events: 'calendar_events',
  transactions: 'transactions', stockMovements: 'stock_movements', entregas: 'deliveries',
  atendimentos: 'appointments', commissions: 'commissions',
} as const;
type CollectionKey = keyof typeof collections;
type Snapshot = Record<string, unknown>;
type SyncState = { status: 'idle' | 'loading' | 'ready' | 'saving' | 'error' | 'warning' | 'conflict'; error: string | null };

let syncState: SyncState = { status: 'idle', error: null };
const listeners = new Set<(state: SyncState) => void>();
function publish(status: SyncState['status'], error: string | null = null) {
  syncState = { status, error };
  listeners.forEach((listener) => listener(syncState));
}
export const businessSyncStatus = {
  get: () => syncState,
  reportError(message: string) { publish('error', message); },
  reportWarning(message: string) { publish('warning', message); },
  subscribe(listener: (state: SyncState) => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

function snapshotFromStore(state: AppStore): Snapshot {
  const snapshot: Snapshot = {};
  for (const [local, remote] of Object.entries(collections)) snapshot[remote] = state[local as CollectionKey];
  snapshot.generic_plugin_items = Object.entries(state.genericPluginItems).flatMap(([pluginId, items]) =>
    (items ?? []).map((item) => ({ ...item, pluginId })));
  snapshot.preferences = {
    aiDisclosureAcceptedVersion: state.aiDisclosureAcceptedVersion,
    onboardingDraft: state.onboardingDraft,
    onboardingReportDraft: state.onboardingCompleted || !state.pendingOnboardingExtraction ? null : { extraction: state.pendingOnboardingExtraction, isSimulation: state.pendingOnboardingExtractionIsSimulation },
    learnedIntentMarkers: state.learnedIntentMarkers,
    dismissedTaskSuggestionIds: state.dismissedTaskSuggestionIds,
    customTaskTags: state.customTaskTags,
    dismissedPluginSuggestions: state.dismissedPluginSuggestions,
    activatedPlugins: state.activatedPlugins,
    pluginOrder: state.pluginOrder,
    businessName: state.businessName,
    businessType: state.businessType,
    taxonomy: state.taxonomy,
    onboardingExtraction: state.onboardingExtraction,
    financialExpenseCategories: state.financialExpenseCategories,
    financialIncomeCategories: state.financialIncomeCategories,
    taskTags: state.taskTags,
    calendarEventTypes: state.calendarEventTypes,
    keywordMap: state.keywordMap,
    recommendedPlugins: state.recommendedPlugins,
  };
  return snapshot;
}

function hydrate(snapshot: Snapshot) {
  const patch: Record<string, unknown> = {};
  for (const [local, remote] of Object.entries(collections)) {
    patch[local] = Array.isArray(snapshot[remote]) ? snapshot[remote] : [];
  }
  const generic: Record<string, Array<{ id: string; values: Record<string, string> }>> = {};
  for (const raw of Array.isArray(snapshot.generic_plugin_items) ? snapshot.generic_plugin_items : []) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as { pluginId?: string; id?: string; values?: Record<string, string> };
    if (!item.pluginId || !item.id || !item.values) continue;
    (generic[item.pluginId] ??= []).push({ id: item.id, values: item.values });
  }
  patch.genericPluginItems = generic as Partial<Record<PluginId, Array<{ id: string; values: Record<string, string> }>>>;
  const prefs = snapshot.preferences && typeof snapshot.preferences === 'object' ? snapshot.preferences as Record<string, unknown> : {};
  for (const key of ['learnedIntentMarkers', 'dismissedTaskSuggestionIds', 'customTaskTags', 'dismissedPluginSuggestions', 'activatedPlugins', 'pluginOrder']) {
    if (Array.isArray(prefs[key])) patch[key] = prefs[key];
  }
  for (const key of ['businessName', 'businessType']) if (typeof prefs[key] === 'string') patch[key] = prefs[key];
  for (const key of ['taxonomy', 'onboardingExtraction', 'keywordMap']) if (key in prefs && (prefs[key] === null || typeof prefs[key] === 'object')) patch[key] = prefs[key];
  for (const key of ['financialExpenseCategories', 'financialIncomeCategories', 'taskTags', 'calendarEventTypes', 'recommendedPlugins']) {
    if (Array.isArray(prefs[key])) patch[key] = prefs[key];
  }
  patch.aiDisclosureAcceptedVersion = typeof prefs.aiDisclosureAcceptedVersion === 'string' ? prefs.aiDisclosureAcceptedVersion : null;
  if ('onboardingDraft' in prefs) {
    patch.onboardingDraft = prefs.onboardingDraft;
    const draft = prefs.onboardingDraft as import('../types/onboardingDraft').OnboardingDraft | null;
    if (draft?.responses) patch.openAnswers = draft.responses;
  }
  if ('onboardingReportDraft' in prefs) {
    const report = prefs.onboardingReportDraft as { extraction?: import('../ai/types').OnboardingExtractionResult; isSimulation?: boolean } | null;
    patch.pendingOnboardingExtraction = report?.extraction ?? null;
    patch.pendingOnboardingExtractionIsSimulation = report?.isSimulation ?? false;
  }
  suppressChanges = true;
  try { useAppStore.setState(patch as Partial<AppStore>); }
  finally { suppressChanges = false; }
}

let owner: string | null = null;
let revision = 0;
let confirmed: Snapshot | null = null;
let unsubscribe: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let pending = false;
type CommitRequest = { id: string; revision: number; snapshot: Snapshot; messages: Record<string, unknown>[]; onboarding: Record<string, unknown> | null };
let outstanding: CommitRequest | null = null;
let pendingOnboarding: Record<string, unknown> | null = null;
let generation = 0;
let suppressChanges = false;
let changeHolds = 0;
let resolutionEpoch = 0;
let inFlight: Promise<void> | null = null;
let journalWrites: Promise<void> = Promise.resolve();
let conflictRemote: { revision: number; snapshot: Snapshot } | null = null;
let chatPreparation: { before: Snapshot; after: Snapshot; ids: string[] } | null = null;
let rejectedPaths: string[] = [];
const journalKey = (id: string) => '@lumio/unsaved/' + supabaseProjectScope + '/' + id;
const clone = (value: Snapshot): Snapshot => JSON.parse(JSON.stringify(value));
function journal() {
  if (!owner || !confirmed) return;
  const activeGeneration = generation;
  const key = journalKey(owner);
  const draft = JSON.stringify({ base: confirmed, snapshot: snapshotFromStore(useAppStore.getState()), onboarding: pendingOnboarding, outstanding, chatPreparation, rejectedPaths });
  journalWrites = journalWrites.catch(() => {}).then(() => AsyncStorage.setItem(key, draft));
  void journalWrites.catch(() => { if (activeGeneration === generation) publish('error', 'Não foi possível preservar o rascunho no aparelho. Mantenha o aplicativo aberto e tente salvar novamente.'); });
}
function requireOwner() {
  if (!owner || !confirmed || !supabase) throw new Error('Aguarde o carregamento da conta antes de salvar.');
}
async function fetchRemote(): Promise<{ revision: number; snapshot: Snapshot }> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase.rpc('get_business_state');
  if (error) throw new Error('Não foi possível carregar seus dados. Verifique a conexão e tente novamente.');
  if (!data || typeof data !== 'object' || !Number.isSafeInteger(data.revision)) throw new Error('Resposta inválida do servidor.');
  const { revision: value, ...snapshot } = data as { revision: number } & Snapshot;
  return { revision: value, snapshot };
}
async function receiptFor(userId: string, request: CommitRequest) {
  const { data, error } = await supabase!.from('business_commit_receipts').select('revision').eq('owner_id', userId).eq('id', request.id).maybeSingle();
  if (error) throw new Error('Não foi possível verificar a confirmação anterior. Tente novamente com internet.');
  return data?.revision as number | undefined;
}
async function recoverAcknowledgement() {
  if (!outstanding || !owner) return;
  const epoch = generation;
  const request = outstanding;
  const acknowledged = await receiptFor(owner, request);
  if (epoch !== generation) throw new Error('A conta foi alterada.');
  if (acknowledged !== undefined) {
    if (!Number.isSafeInteger(acknowledged)) throw new Error('Confirmação inválida do servidor.');
    confirmed = clone(request.snapshot); revision = acknowledged;
    if (snapshotsEqual(pendingOnboarding, request.onboarding)) pendingOnboarding = null;
    await chatHistoryService.acknowledge(request.messages);
    if (epoch !== generation) throw new Error('A conta foi alterada.');
    outstanding = null;
  }
}
async function synchronize() {
  requireOwner();
  const activeGeneration = generation;
  const remote = await fetchRemote();
  if (activeGeneration !== generation) throw new Error('A conta foi alterada durante a sincronização.');
  const merged = mergeSnapshots(confirmed!, snapshotFromStore(useAppStore.getState()), remote.snapshot);
  if (merged.conflicts.length) {
    conflictRemote = remote;
    publish('conflict', 'Outro aparelho alterou os mesmos dados. Escolha qual versão manter; seu rascunho foi preservado.');
    throw new Error('Conflito entre aparelhos. Resolva o conflito antes de salvar.');
  }
  confirmed = clone(remote.snapshot);
  revision = remote.revision;
  hydrate(merged.snapshot);
  pending = !snapshotsEqual(merged.snapshot, remote.snapshot);
  if (pending) journal();
}
async function drain() {
  requireOwner();
  if (conflictRemote) throw new Error('Resolva o conflito antes de salvar.');
  const activeGeneration = generation;
  const activeOwner = owner!;
  publish(pending || pendingOnboarding || chatHistoryService.hasPending() ? 'saving' : 'loading');
  try {
    await recoverAcknowledgement();
    await synchronize();
    let conflicts = 0;
    while (pending || chatHistoryService.hasPending() || pendingOnboarding || outstanding) {
      await journalWrites;
      await chatHistoryService.waitForJournal();
      if (activeGeneration !== generation) throw new Error('A conta foi alterada.');
      if (!outstanding) {
        assertBusinessSnapshot(snapshotFromStore(useAppStore.getState()));
        outstanding = { id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), revision,
          snapshot: clone(snapshotFromStore(useAppStore.getState())), messages: chatHistoryService.batch(), onboarding: pendingOnboarding };
        journal(); await journalWrites;
      }
      const request = outstanding;
      const { snapshot, messages, onboarding } = request;
      const { data, error } = await supabase!.rpc('commit_lumio_state', { expected_revision: request.revision, snapshot, chat_messages: messages, onboarding_record: onboarding, request_id: request.id });
      if (activeGeneration !== generation) throw new Error('A conta foi alterada.');
      if (error) {
        if (error.code === 'PT409' && conflicts++ < 3) { outstanding = null; await synchronize(); continue; }
        if (['23502','23503','23514','23505','22023','22P02','42501'].includes(error.code)) outstanding = null;
        throw new PersistenceError('Não foi possível salvar. ' + (['23502','23503','23514','23505','22023','22P02'].includes(error.code) ? 'Revise os campos e vínculos do cadastro e tente novamente.' : 'Conecte-se à internet e tente novamente. Seu rascunho foi preservado.'), error.code ?? 'NETWORK');
      }
      if (!Number.isSafeInteger(data) || data <= request.revision) throw new Error('O servidor não confirmou a gravação. Tente novamente.');
      revision = data as number;
      confirmed = snapshot;
      if (pendingOnboarding === onboarding) pendingOnboarding = null;
      await chatHistoryService.acknowledge(messages);
      if (activeGeneration !== generation) throw new Error('A conta foi alterada.');
      outstanding = null; chatPreparation = null;
      pending = !snapshotsEqual(snapshotFromStore(useAppStore.getState()), snapshot);
      if (pending) journal();
    }
    journalWrites = journalWrites.catch(() => {}).then(() => AsyncStorage.removeItem(journalKey(activeOwner)));
    await journalWrites;
    if (activeGeneration === generation && (pending || pendingOnboarding || outstanding || chatHistoryService.hasPending())) return drain();
    if (activeGeneration === generation) publish('ready');
  } catch (error) {
    if (activeGeneration === generation) {
      if (isRejectedValidation(error) && chatPreparation) {
        const rejected = chatPreparation;
        if (businessStateService.cancelRejectedPreparation(rejected.before, rejected.after)) {
          await chatHistoryService.reject(rejected.ids); chatPreparation = null; outstanding = null;
        } else {
          // Preserve the overlapping version before an explicit group recovery.
          await AsyncStorage.setItem('@lumio/rejected/' + supabaseProjectScope + '/' + activeOwner + '/' + Date.now(), JSON.stringify({ preparation: rejected, current: snapshotFromStore(useAppStore.getState()), messages: chatHistoryService.batch() }));
          rejectedPaths = changedSnapshotPaths(rejected.before,rejected.after);
          conflictRemote = await fetchRemote();
          journal();
          publish('conflict','Uma tentativa foi rejeitada e há edições vinculadas posteriores. A cópia foi preservada; use a versão remota do grupo e refaça a operação.');
        }
      }
      pending = !!confirmed && !snapshotsEqual(snapshotFromStore(useAppStore.getState()), confirmed);
      if (pending) journal();
      if (!conflictRemote) publish('error', error instanceof Error ? error.message : 'Falha ao sincronizar. Tente novamente.');
    }
    throw error;
  }
}

export const businessStateService = {
  async waitForJournal() { await journalWrites; await chatHistoryService.waitForJournal(); },
  stageChatPreparation(before: Snapshot, ids: string[]) {
    requireOwner();
    if (rejectedPaths.length) throw new Error('Resolva a tentativa rejeitada antes de enviar outro comando.');
    const after = snapshotFromStore(useAppStore.getState()); assertBusinessSnapshot(after);
    chatPreparation = { before, after: clone(after), ids }; journal();
  },
  capturePreparation() { return clone(snapshotFromStore(useAppStore.getState())); },
  cancelRejectedPreparation(before: Snapshot, after: Snapshot) {
    const reverted = mergeSnapshots(after, snapshotFromStore(useAppStore.getState()), before);
    if (reverted.conflicts.length) return false;
    hydrate(reverted.snapshot);
    pending = !!confirmed && !snapshotsEqual(reverted.snapshot, confirmed);
    journal();
    return true;
  },
  scope() { return generation + ':' + resolutionEpoch + ':' + (owner ?? ''); },
  stageOnboarding(record: Record<string, unknown>) { requireOwner(); pendingOnboarding = record; journal(); },
  holdChanges() { changeHolds++; if (timer) clearTimeout(timer); timer = null; },
  releaseChanges() { changeHolds = Math.max(0, changeHolds - 1); },
  hasUnsavedChanges() { return pending || !!outstanding || !!pendingOnboarding || chatHistoryService.hasPending() || !!inFlight || !!conflictRemote; },
  isStarted(userId?: string) { return !!owner && (!userId || owner === userId); },
  async commit(): Promise<void> {
    requireOwner();
    if (timer) { clearTimeout(timer); timer = null; }
    if (inFlight) { await inFlight; if (pending || outstanding || pendingOnboarding || chatHistoryService.hasPending()) return this.commit(); return; }
    const operation = drain();
    inFlight = operation;
    try { await operation; }
    finally { if (inFlight === operation) inFlight = null; }
    if (pending || outstanding || pendingOnboarding || chatHistoryService.hasPending()) await this.commit();
  },
  async refresh() { await this.commit(); useAppStore.getState().refreshContratos(); if (pending) await this.commit(); },
  canKeepLocal() {
    if (rejectedPaths.length) return false;
    if (!conflictRemote || !confirmed) return true;
    const local = snapshotFromStore(useAppStore.getState());
    return conflictGroup(confirmed, local, conflictRemote.snapshot, mergeSnapshots(confirmed, local, conflictRemote.snapshot).conflicts).canKeepLocal;
  },
  conflictDetails() {
    if (!conflictRemote || !confirmed) return '';
    return [...mergeSnapshots(confirmed, snapshotFromStore(useAppStore.getState()), conflictRemote.snapshot).conflicts, ...rejectedPaths].join('\n');
  },
  async resolveConflict(choice: ConflictChoice) {
    requireOwner();
    if (!conflictRemote) return;
    const activeGeneration = generation;
    await recoverAcknowledgement();
    const remote = await fetchRemote();
    if (outstanding && remote.revision > outstanding.revision) outstanding = null;
    if (activeGeneration !== generation) throw new Error('A conta foi alterada.');
    const local = snapshotFromStore(useAppStore.getState());
    const conflicts = mergeSnapshots(confirmed!, local, remote.snapshot).conflicts;
    if (choice === 'local' && !conflictGroup(confirmed!, local, remote.snapshot, conflicts).canKeepLocal) throw new Error('Este conflito envolve operações vinculadas. Use a versão remota e tente sua operação novamente com os valores atualizados.');
    if (rejectedPaths.length && choice !== 'remote') throw new Error('Esta tentativa foi rejeitada pelo servidor; restaure o grupo remoto.');
    const merged = { snapshot: resolveWithRemote(confirmed!, local, remote.snapshot, choice, rejectedPaths) };
    if (choice === 'remote') resolutionEpoch++;
    if (choice === 'remote') await chatHistoryService.resolveBusinessConflict();
    confirmed = clone(remote.snapshot); revision = remote.revision; conflictRemote = null;
    rejectedPaths = []; chatPreparation = null;
    hydrate(merged.snapshot); pending = !snapshotsEqual(merged.snapshot, confirmed);
    if (pending) journal();
    await this.commit();
  },
  async start(userId: string) {
    if (owner === userId) { await this.refresh(); return; }
    this.stop();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase não configurado.');
    const activeGeneration = generation;
    publish('loading');
    const { data, error } = await supabase.auth.getUser();
    if (error) throw new Error('Não foi possível verificar a sessão. Tente novamente com internet.');
    if (data.user?.id !== userId) throw new Error('Sessão inválida.');
    let remote = await fetchRemote();
    const raw = await AsyncStorage.getItem(journalKey(userId));
    if (activeGeneration !== generation) return;
    let restored = remote.snapshot;
    let base = clone(remote.snapshot);
    if (raw) {
      let draft: { base: Snapshot; snapshot: Snapshot; outstanding?: CommitRequest; onboarding?: Record<string, unknown>; chatPreparation?: typeof chatPreparation; rejectedPaths?: string[] };
      try { draft = JSON.parse(raw); }
      catch { throw new Error('Rascunho local inválido. A cópia foi preservada para recuperação.'); }
      if (!draft.base || !draft.snapshot) throw new Error('Rascunho local inválido.');
      chatPreparation = draft.chatPreparation ?? null;
      rejectedPaths = draft.rejectedPaths ?? [];
      if (draft.outstanding) {
        const receipt = await receiptFor(userId, draft.outstanding);
        if (activeGeneration !== generation) return;
        if (receipt !== undefined) {
          draft.base = draft.outstanding.snapshot;
          if (snapshotsEqual(draft.onboarding, draft.outstanding.onboarding)) draft.onboarding = undefined;
          remote = await fetchRemote();
          if (activeGeneration !== generation) return;
        }
        else outstanding = draft.outstanding;
      }
      const merged = mergeSnapshots(draft.base, draft.snapshot, remote.snapshot);
      restored = merged.snapshot;
      pendingOnboarding = draft.onboarding ?? null;
      if (merged.conflicts.length || rejectedPaths.length) { base = draft.base; conflictRemote = remote; }
    } else if (!Object.keys((remote.snapshot.preferences ?? {}) as object).length) {
      // Bootstrap preferences of legacy accounts once, through the revision-checked RPC.
      restored = { ...remote.snapshot, preferences: snapshotFromStore(useAppStore.getState()).preferences };
    }
    setDraftIdentity(supabaseProjectScope, userId);
    owner = userId; revision = remote.revision; confirmed = base;
    hydrate(restored);
    if (pendingOnboarding) useAppStore.setState({ openAnswers: pendingOnboarding.responses as Record<string, string>,
      onboardingContext: (pendingOnboarding.context ?? null) as AppStore['onboardingContext'],
      pendingOnboardingExtraction: (pendingOnboarding.structuredProfile ?? null) as AppStore['pendingOnboardingExtraction'] });
    pending = !snapshotsEqual(restored, confirmed);
    let previous = JSON.stringify(snapshotFromStore(useAppStore.getState()));
    unsubscribe = useAppStore.subscribe((state) => {
      const current = JSON.stringify(snapshotFromStore(state));
      if (suppressChanges) { previous = current; return; }
      if (current === previous) return;
      previous = current; pending = true; journal();
      if (!conflictRemote) publish('saving');
      if (timer) clearTimeout(timer);
      if (!changeHolds) timer = setTimeout(() => { timer = null; void this.commit().catch(() => {}); }, 150);
    });
    let billingWarning: string | null = null;
    if (!conflictRemote) { try { useAppStore.getState().refreshContratos(); } catch { billingWarning = 'Há um contrato com data inválida ou histórico extenso. Revise-o em Contratos antes de gerar cobranças.'; } }
    if (conflictRemote) publish('conflict', 'Há um rascunho em conflito com outro aparelho. Escolha qual versão manter.');
    else if (pending || pendingOnboarding || outstanding) { journal(); publish('error', 'Há alterações não confirmadas recuperadas. Conecte-se à internet e toque em Tentar novamente.'); }
    else if (billingWarning) publish('warning', billingWarning);
    else publish('ready');
  },
  stop() {
    generation++; setDraftIdentity(supabaseProjectScope, null);
    inFlight = null;
    if (timer) clearTimeout(timer);
    timer = null; unsubscribe?.(); unsubscribe = null;
    owner = null; revision = 0; confirmed = null; pending = false; pendingOnboarding = null; outstanding = null; conflictRemote = null; chatPreparation = null; rejectedPaths = [];
    publish('idle');
  },
  clearPrivateState() {
    const empty: Snapshot = {};
    for (const remote of Object.values(collections)) empty[remote] = [];
    empty.generic_plugin_items = []; empty.preferences = {};
    hydrate(empty);
    useAppStore.getState().resetOnboardingState();
    useAppStore.getState().clearMessages();
    chatHistoryService.stop();
  },
};
