import { protectedStorage as AsyncStorage } from './protectedStorage';
import { supabase, supabaseProjectScope } from '../lib/supabase';
import { useAppStore } from '../store';
import type { ChatHistoryMessage } from '../types/chat';
import { deserializeChatMessage, serializeChatMessage } from './chatSerialization';

let owner: string | null = null;
let generation = 0;
let pending: Record<string, unknown>[] = [];
let original: ChatHistoryMessage[] = [];
let journal: Promise<void> = Promise.resolve();
const key = (id: string) => '@lumio/chat-unsaved/' + supabaseProjectScope + '/' + id;
export const chatHistoryService = {
  async start(userId: string) {
    if (owner !== userId) this.stop();
    const epoch = generation;
    if (!supabase) throw new Error('Supabase não configurado.');
    const live = owner === userId ? useAppStore.getState().chatHistory : [];
    const messages: ChatHistoryMessage[] = [];
    const confirmedIds = new Set<string>();
    let cursor = 0;
    while (true) {
      const { data, error } = await supabase.from('chat_messages').select('sequence,payload').eq('owner_id', userId).gt('sequence', cursor).order('sequence').limit(500);
      if (error) throw new Error('Não foi possível carregar o Chat (' + error.code + '). Tente novamente.');
      if (epoch !== generation) return;
      for (const row of data ?? []) { confirmedIds.add(row.payload.id); messages.push(live.find(item => item.id === row.payload.id) ?? deserializeChatMessage(row.payload)); }
      if (!data || data.length < 500) break;
      cursor = data[data.length - 1].sequence;
    }
    const raw = await AsyncStorage.getItem(key(userId));
    if (epoch !== generation) return;
    if (owner !== userId) {
      const draft: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(draft)) throw new Error('Rascunho do Chat inválido. A cópia foi preservada.');
      pending = draft.filter(message => !confirmedIds.has(message.id));
      original = [];
    }
    owner = userId;
    const current = owner === userId ? useAppStore.getState().chatHistory : [];
    const recovered = pending.map(payload => ({ ...deserializeChatMessage(payload), pending: true, historical: true }));
    useAppStore.getState().setChatHistory([...messages, ...current.filter(item => !messages.some(existing => existing.id === item.id) && !pending.some(payload => payload.id === item.id)), ...recovered]);
  },
  async stage(messages: ChatHistoryMessage[]) {
    if (!owner) throw new Error('Aguarde o carregamento do Chat antes de enviar.');
    const userId = owner;
    const epoch = generation;
    const serialized = messages.map(serializeChatMessage);
    for (const message of serialized) if (!useAppStore.getState().chatHistory.some(item => item.id === message.id && !item.pending) && !pending.some(item => item.id === message.id)) pending.push(message);
    original.push(...messages.filter(message => !original.some(item => item.id === message.id)));
    const raw = JSON.stringify(pending);
    journal = journal.catch(() => {}).then(() => AsyncStorage.setItem(key(userId), raw));
    await journal;
    if (epoch !== generation) throw new Error('A conta foi alterada.');
  },
  async resolveBusinessConflict() {
    const text = 'A edição conflitante foi substituída pela versão confirmada em outro aparelho. As demais alterações foram preservadas.';
    pending = pending.map(message => message.type === 'user' ? message : { id: message.id, type: message.type, text, timestamp: message.timestamp });
    original = original.map(message => message.type === 'user' ? message : { id: message.id, type: message.type, text, timestamp: message.timestamp });
    if (owner) { const userId = owner; const raw = JSON.stringify(pending); journal = journal.catch(() => {}).then(() => AsyncStorage.setItem(key(userId), raw)); await journal; }
  },
  async waitForJournal() { await journal; },
  async reject(ids: string[]) {
    if (!owner) return;
    const userId = owner;
    pending = pending.filter(message => !ids.includes(String(message.id)));
    original = original.filter(message => !ids.includes(message.id));
    useAppStore.getState().setChatHistory(useAppStore.getState().chatHistory.filter(message => !ids.includes(message.id)));
    const raw = JSON.stringify(pending);
    journal = journal.catch(() => {}).then(() => raw === '[]' ? AsyncStorage.removeItem(key(userId)) : AsyncStorage.setItem(key(userId), raw));
    await journal;
  },
  batch() { return pending.map(item => ({ ...item })); },
  hasPending() { return pending.length > 0; },
  async acknowledge(batch: Record<string, unknown>[]) {
    if (!owner) return;
    const epoch = generation;
    const userId = owner;
    const ids = new Set(batch.map(item => item.id));
    const acknowledged = batch.map(payload => ({ ...(original.find(item => item.id === payload.id) ?? deserializeChatMessage(payload)), pending: false }));
    pending = pending.filter(item => !ids.has(item.id));
    original = original.filter(item => !ids.has(item.id));
    const history = useAppStore.getState().chatHistory;
    useAppStore.getState().setChatHistory([...history.map(message => acknowledged.find(item => item.id === message.id) ?? message), ...acknowledged.filter(item => !history.some(existing => existing.id === item.id))]);
    const raw = JSON.stringify(pending);
    journal = journal.catch(() => {}).then(() => raw === '[]' ? AsyncStorage.removeItem(key(userId)) : AsyncStorage.setItem(key(userId), raw));
    await journal;
    if (epoch !== generation) return;
  },
  stop() { generation++; owner = null; pending = []; original = []; useAppStore.getState().setChatHistory([]); },
};
