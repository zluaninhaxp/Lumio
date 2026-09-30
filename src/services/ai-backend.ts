import { supabase } from '../lib/supabase';
import { AIProviderError, MissingApiKeyError } from '../ai/aiProvider';

export async function invokeAiBackend(
  action: 'status' | 'set_key' | 'delete_key' | 'test' | 'generate',
  extra: Record<string, unknown> = {}, expectedUserId?: string,
): Promise<Record<string, unknown>> {
  if (!supabase) throw new AIProviderError('backend');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (sessionError || !session || (expectedUserId && session.user.id !== expectedUserId)) throw new AIProviderError('not-authenticated');
  const userId = session.user.id;
  let result;
  try {
    result = await supabase.functions.invoke('ai', {
      body: { action, ...extra }, headers: { Authorization: `Bearer ${session.access_token}` },
      timeout: action === 'generate' ? 135000 : 40000,
    });
  } catch (error) {
    throw new AIProviderError((error as { name?: string })?.name === 'AbortError' ? 'timeout' : action === 'status' ? 'status-unavailable' : 'network');
  }
  const { data, error } = result;
  const current = await supabase.auth.getSession();
  if (current.error || current.data.session?.user.id !== userId) throw new AIProviderError('not-authenticated');
  if (error) {
    const response = (error as { context?: { status?: number; json?: () => Promise<unknown> } }).context;
    let code: unknown;
    try { code = ((await response?.json?.()) as { error?: unknown })?.error; } catch { /* Never expose raw response bodies. */ }
    if (code === 'missing_key') throw new MissingApiKeyError();
    if (code === 'unauthorized' || response?.status === 401) throw new AIProviderError('not-authenticated');
    if (code === 'provider_rejected_key') throw new AIProviderError('unauthorized');
    if (code === 'provider_quota') throw new AIProviderError('quota-exceeded');
    if (code === 'rate_limited') throw new AIProviderError('quota-exceeded', 'Limite de uso do Lumio atingido. Tente novamente mais tarde.');
    if (code === 'provider_timeout' || response?.status === 504) throw new AIProviderError('timeout');
    if (code === 'invalid_response') throw new AIProviderError('bad-format');
    if (code === 'invalid_input') throw new AIProviderError('invalid-input');
    if (code === 'provider_unavailable') throw new AIProviderError('provider');
    if (code === 'provider_transport_error') throw new AIProviderError('provider');
    if (code === 'provider_invalid_request') throw new AIProviderError('provider-request');
    if (code === 'provider_precondition') throw new AIProviderError('payment-required');
    if (code === 'provider_model_unavailable') throw new AIProviderError('provider-model');
    if (action === 'status') throw new AIProviderError('status-unavailable');
    if (response?.status || (error as { name?: string }).name === 'FunctionsRelayError') throw new AIProviderError('backend');
    throw new AIProviderError('network');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AIProviderError('bad-format');
  return data as Record<string, unknown>;
}
