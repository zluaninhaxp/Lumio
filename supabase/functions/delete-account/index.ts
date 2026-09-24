// @ts-nocheck -- Deno Edge runtime types are checked by Supabase CLI.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { admin, authorized, json, limited, readLimitedBody } from '../_shared/secure.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const uid = await authorized(req);
  if (!uid) return json({ error: 'unauthorized' }, 401);
  try {
    if (!await limited(uid, 'delete_account', 5, 3600)) return json({ error: 'rate_limited' }, 429);
  } catch { return json({ error: 'service_unavailable' }, 503); }
  let body: Record<string, unknown>;
  try {
    const raw = await readLimitedBody(req, 1024);
    if (raw === null) return json({ error: 'invalid_input' }, 413);
    body = JSON.parse(raw);
  } catch { return json({ error: 'invalid_input' }, 400); }
  if (typeof body?.password !== 'string' || body.password.length < 6 || body.password.length > 256 || Object.keys(body).some((key) => key !== 'password')) return json({ error: 'invalid_input' }, 400);
  try {
    const { data: identity, error: identityError } = await admin.auth.getUser(req.headers.get('Authorization')!.slice(7));
    if (identityError || identity.user?.id !== uid || !identity.user.email) return json({ error: 'unauthorized' }, 401);
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!anonKey) throw new Error('Auth configuration missing');
    const verifier = createClient(Deno.env.get('SUPABASE_URL')!, anonKey, { auth: { persistSession: false } });
    const proof = await verifier.auth.signInWithPassword({ email: identity.user.email, password: body.password });
    if (proof.error || proof.data.user?.id !== uid) return json({ error: 'invalid_credentials' }, 403);
    const listed = await admin.storage.from('profile-photos').list(uid, { limit: 1000 });
    if (listed.error) throw listed.error;
    const paths = (listed.data ?? []).filter((item) => item.name.endsWith('.webp')).map((item) => `${uid}/${item.name}`);
    if (paths.length) {
      const removed = await admin.storage.from('profile-photos').remove(paths);
      if (removed.error) throw removed.error;
    }
    const deleted = await admin.auth.admin.deleteUser(uid);
    if (deleted.error) throw deleted.error;
    return json({ deleted: true });
  } catch {
    return json({ error: 'service_unavailable' }, 503);
  }
});
