// Bound requests so authentication and persistence failures remain recoverable.
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const controller = new AbortController();
  const signal = init?.signal ?? (typeof input === 'object' && 'signal' in input ? input.signal : undefined);
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort);
  const timer = setTimeout(abort, url.includes('/auth/v1/') ? 20_000 : url.includes('/functions/v1/ai') ? 150_000 : 30_000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
