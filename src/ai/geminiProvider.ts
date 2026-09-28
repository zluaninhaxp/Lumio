import { AIProvider, AIProviderError, MissingApiKeyError } from './aiProvider';
import { supabase } from '../lib/supabase';

export const GEMINI_MODEL = 'gemini-2.5-flash';
export const GEMINI_LABEL = 'Google Gemini';

async function invoke(action: 'generate' | 'test', prompt?: string): Promise<{ text?: string }> {
  if (!supabase) throw new AIProviderError('provider', 'Serviço de IA não configurado.');
  const { data, error } = await supabase.functions.invoke('ai', { body: { action, ...(prompt ? { prompt } : {}) } });
  if (error) {
    const response = (error as { context?: Response }).context;
    let code: string | undefined;
    try { code = (await response?.json())?.error; } catch { /* Generic error below. */ }
    if (code === 'missing_key') throw new MissingApiKeyError();
    if (code === 'provider_rejected_key') throw new AIProviderError('unauthorized');
    if (code === 'provider_quota') throw new AIProviderError('quota-exceeded');
    if (code === 'rate_limited') throw new AIProviderError('quota-exceeded', 'Limite de uso do Lumio atingido. Tente novamente mais tarde.');
    throw new AIProviderError(response?.status === 400 ? 'invalid-input' : 'network');
  }
  return data as { text?: string };
}

export const geminiProvider: AIProvider = {
  id: 'gemini', label: GEMINI_LABEL,
  async generate(prompt: string): Promise<string> {
    if (!prompt || prompt.length > 100000) throw new AIProviderError('invalid-input');
    const result = await invoke('generate', prompt);
    if (typeof result.text !== 'string') throw new AIProviderError('bad-format');
    return result.text;
  },
  async testKey(): Promise<void> { await invoke('test'); },
};
