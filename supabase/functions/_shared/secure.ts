// @ts-nocheck -- Deno Edge runtime types are checked by Supabase CLI.
import { createClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceKey) throw new Error('Server configuration missing');
export const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
export async function authorized(req: Request): Promise<string | null> {
  const match = /^Bearer (.+)$/i.exec(req.headers.get('Authorization') ?? '');
  if (!match) return null;
  const { data, error } = await admin.auth.getUser(match[1]);
  return error ? null : data.user?.id ?? null;
}
export async function limited(uid: string, operation: string, maxHits: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await admin.rpc('consume_private_rate_limit', {
    subject: uid, operation_name: operation, max_hits: maxHits, window_seconds: windowSeconds,
  });
  if (error) throw new Error('Rate limit unavailable');
  return data === true;
}
export function hex(bytes: Uint8Array): string {
  return `\\x${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}`;
}
export function unhex(value: string): Uint8Array {
  const raw = value.startsWith('\\x') ? value.slice(2) : value;
  if (!/^(?:[0-9a-f]{2})+$/i.test(raw)) throw new Error('Invalid encrypted value');
  return new Uint8Array(raw.match(/../g)!.map((part) => Number.parseInt(part, 16)));
}
export async function readLimitedBody(req: Request, maximum: number): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > maximum) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}
