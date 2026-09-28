import { isSupabaseConfigured, supabase } from '../lib/supabase';
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
type SyncState = { status: 'idle' | 'loading' | 'ready' | 'saving' | 'error' | 'warning'; error: string | null };

let syncState: SyncState = { status: 'idle', error: null };
const listeners = new Set<(state: SyncState) => void>();
function publish(status: SyncState['status'], error: string | null = null) {
  syncState = { status, error };
  listeners.forEach((listener) => listener(syncState));
}
export const businessSyncStatus = {
  get: () => syncState,
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
  for (const key of ['customTaskTags', 'dismissedPluginSuggestions', 'activatedPlugins', 'pluginOrder']) {
    if (Array.isArray(prefs[key])) patch[key] = prefs[key];
  }
  for (const key of ['businessName', 'businessType']) if (typeof prefs[key] === 'string') patch[key] = prefs[key];
  for (const key of ['taxonomy', 'onboardingExtraction', 'keywordMap']) if (prefs[key] && typeof prefs[key] === 'object') patch[key] = prefs[key];
  for (const key of ['financialExpenseCategories', 'financialIncomeCategories', 'taskTags', 'calendarEventTypes', 'recommendedPlugins']) {
    if (Array.isArray(prefs[key])) patch[key] = prefs[key];
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
let writing = false;
let pending = false;
let generation = 0;
let suppressChanges = false;

async function fetchRemote(): Promise<{ revision: number; snapshot: Snapshot }> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase.rpc('get_business_state');
  if (error) throw new Error('Não foi possível carregar seus dados de negócio.');
  if (!data || typeof data !== 'object' || typeof data.revision !== 'number') throw new Error('Resposta inválida do servidor.');
  const { revision: value, ...snapshot } = data as { revision: number } & Snapshot;
  return { revision: value, snapshot };
}

async function flush() {
  if (!owner || writing || !pending || !supabase) return;
  writing = true;
  pending = false;
  const activeGeneration = generation;
  const snapshot = snapshotFromStore(useAppStore.getState());
  publish('saving');
  try {
    const { data, error } = await supabase.rpc('replace_business_state', { expected_revision: revision, snapshot });
    if (error) throw new Error('Não foi possível salvar seus dados. Verifique a conexão e tente novamente.');
    if (activeGeneration !== generation) return;
    revision = data as number;
    confirmed = snapshot;
    publish('ready');
  } catch {
    if (activeGeneration !== generation) return;
    // The server is authoritative. A rejected optimistic write is reverted;
    // newer queued edits are also dropped rather than silently kept as saved.
    pending = false;
    if (confirmed) hydrate(confirmed);
    publish('error', 'Alterações não salvas foram desfeitas. Tente novamente.');
    try {
      const remote = await fetchRemote();
      if (activeGeneration === generation) {
        revision = remote.revision;
        confirmed = remote.snapshot;
        hydrate(remote.snapshot);
      }
    } catch { /* Keep the last confirmed state until the next login. */ }
  } finally {
    writing = false;
    if (pending && owner) void flush();
  }
}

export const businessStateService = {
  async commit(): Promise<void> {
    if (timer) { clearTimeout(timer); timer = null; }
    if (pending && !writing) await flush();
    let tries = 0;
    while (writing && tries++ < 600) await new Promise((resolve) => setTimeout(resolve, 50));
    if (writing || syncState.status === 'error') throw new Error('Há alterações não salvas. Tente novamente antes de sair.');
  },
  async start(userId: string) {
    this.stop();
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase não configurado.');
    const activeGeneration = generation;
    publish('loading');
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId) throw new Error('Sessão inválida.');
    const remote = await fetchRemote();
    if (activeGeneration !== generation) return;
    owner = userId;
    revision = remote.revision;
    confirmed = remote.snapshot;
    hydrate(remote.snapshot);
    let previous = JSON.stringify(snapshotFromStore(useAppStore.getState()));
    unsubscribe = useAppStore.subscribe((state) => {
      if (suppressChanges) {
        previous = JSON.stringify(snapshotFromStore(state));
        return;
      }
      const current = JSON.stringify(snapshotFromStore(state));
      if (current === previous) return;
      previous = current;
      pending = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; void flush(); }, 150);
    });
    publish('ready');
  },
  stop() {
    generation++;
    if (timer) clearTimeout(timer);
    timer = null;
    unsubscribe?.();
    unsubscribe = null;
    owner = null;
    revision = 0;
    confirmed = null;
    pending = false;
    publish('idle');
  },
  clearPrivateState() {
    const empty: Snapshot = {};
    for (const remote of Object.values(collections)) empty[remote] = [];
    empty.generic_plugin_items = [];
    empty.preferences = {};
    hydrate(empty);
    useAppStore.getState().resetOnboardingState();
    useAppStore.getState().clearMessages();
  },
};
