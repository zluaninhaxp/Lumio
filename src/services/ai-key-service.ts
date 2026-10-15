import { AIProviderError } from '../ai/aiProvider';
import { invokeAiBackend } from './ai-backend';

export const aiKeyService = {
  async status(userId: string): Promise<boolean> {
    const result = await invokeAiBackend('status', {}, userId);
    if (typeof result.configured !== 'boolean') throw new AIProviderError('bad-format');
    if (__DEV__) console.info('[AI KEY STATUS]', { authenticated: true, configured: result.configured, source: 'backend' });
    return result.configured;
  },
  async save(key: string, userId: string): Promise<void> {
    const value = key.trim();
    if (value.length < 20 || value.length > 256) throw new AIProviderError('invalid-input', 'Chave de IA inválida.');
    const result = await invokeAiBackend('set_key', { key: value }, userId);
    if (result.configured !== true) throw new AIProviderError('backend');
  },
  async remove(userId: string): Promise<void> {
    const result = await invokeAiBackend('delete_key', {}, userId);
    if (result.configured !== false) throw new AIProviderError('backend');
  },
  async test(userId: string, draft?: string): Promise<void> {
    const result = await invokeAiBackend('test', draft?.trim() ? { key: draft.trim() } : {}, userId);
    if (result.ok !== true) throw new AIProviderError('bad-format');
  },
};
