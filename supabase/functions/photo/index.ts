// @ts-nocheck -- Deno Edge runtime types are checked by Supabase CLI.
import { admin, authorized, json, limited, readLimitedBody } from '../_shared/secure.ts';
import { readWebpDimensions } from '../_shared/webp.ts';

async function readLimited(req: Request): Promise<Uint8Array | null> {
  const reader = req.body?.getReader();
  if (!reader) return null;
  const parts: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 1048576) {
      // Cancellation may reject after the runtime has already aborted the
      // oversized request body. That should still produce the intended 413.
      // Do not await this: some hosted request streams never settle cancel(),
      // which would hold the handler until the gateway timeout.
      void reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const uid = await authorized(req);
  if (!uid) return json({ error: 'unauthorized' }, 401);
  try {
    if (req.headers.get('Content-Type')?.startsWith('image/webp')) {
      const declared = Number(req.headers.get('Content-Length') ?? 0);
      if (declared > 1048576) return json({ error: 'too_large' }, 413);
      if (!await limited(uid, 'photo_upload', 12, 3600)) return json({ error: 'rate_limited' }, 429);
      const bytes = await readLimited(req);
      if (!bytes || bytes.length < 30) return json({ error: 'too_large' }, 413);
      if (!readWebpDimensions(bytes)) return json({ error: 'invalid_image' }, 400);
      const { data: oldProfile, error: profileError } = await admin.from('profiles').select('photo').eq('id', uid).single();
      if (profileError) throw profileError;
      const path = `${uid}/${crypto.randomUUID()}.webp`;
      const upload = await admin.storage.from('profile-photos').upload(path, bytes, { contentType: 'image/webp', upsert: false });
      if (upload.error) throw upload.error;
      const update = await admin.from('profiles').update({ photo: path, updated_at: new Date().toISOString() }).eq('id', uid).select('photo').single();
      if (update.error) {
        await admin.storage.from('profile-photos').remove([path]);
        throw update.error;
      }
      if (oldProfile.photo?.startsWith(`${uid}/`)) await admin.storage.from('profile-photos').remove([oldProfile.photo]);
      return json({ path });
    }
    const raw = await readLimitedBody(req, 1024);
    if (raw === null) return json({ error: 'invalid_input' }, 413);
    const body = JSON.parse(raw);
    if (body?.action !== 'signed_url') return json({ error: 'invalid_input' }, 400);
    if (!await limited(uid, 'photo_read', 120, 3600)) return json({ error: 'rate_limited' }, 429);
    const { data, error } = await admin.from('profiles').select('photo').eq('id', uid).single();
    if (error) throw error;
    if (!data.photo || !data.photo.startsWith(`${uid}/`)) return json({ url: null });
    const signed = await admin.storage.from('profile-photos').createSignedUrl(data.photo, 3600);
    if (signed.error) throw signed.error;
    return json({ url: signed.data.signedUrl });
  } catch {
    return json({ error: 'service_unavailable' }, 503);
  }
});
