import { AIProvider, AIProviderError } from './aiProvider';
import { invokeAiBackend } from '../services/ai-backend';

export const GEMINI_LABEL = 'Google Gemini';

export const geminiProvider: AIProvider = {
  id: 'gemini', label: GEMINI_LABEL,
  async generate(context) {
    const result = await invokeAiBackend('generate', { context });
    if (typeof result.text !== 'string' || !result.text.trim()) throw new AIProviderError('bad-format');
    return result.text;
  },
};
