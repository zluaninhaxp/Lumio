import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const publicKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publicKey || !serviceKey) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY for an isolated development project.');
  process.exit(2);
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const anonymous = createClient(url, publicKey, { auth: { persistSession: false } });
const users = [];
const collections = ['clients','suppliers','employees','stock_items','catalog_items','orders','quotes','contracts','tasks','calendar_events','transactions','stock_movements','deliveries','appointments','commissions','generic_plugin_items'];
const empty = () => Object.fromEntries([...collections.map((key) => [key, []]), ['preferences', {}]]);

async function account() {
  const email = `lumio-smoke-${randomUUID()}@example.invalid`;
  const password = `${randomUUID()}-Aa1`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  users.push(created.data.user.id);
  const client = createClient(url, publicKey, { auth: { persistSession: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signed.error);
  return { client, id: created.data.user.id, email, password };
}

try {
  const a = await account();
  const b = await account();
  const clientId = `client_${randomUUID()}`;
  const taskId = `task_${randomUUID()}`;
  const eventId = `event_${randomUUID()}`;
  const transactionId = `txn_${randomUUID()}`;
  const stateA = empty();
  stateA.clients.push({ id: clientId, name: 'Cliente de A', contact: '', notes: '', createdAt: new Date().toISOString() });
  stateA.tasks.push({ id: taskId, description: 'Tarefa de A', clientId, done: false, dueDate: null, priority: 'media', subtasks: [], tags: [], createdAt: new Date().toISOString() });
  stateA.calendar_events.push({ id: eventId, description: 'Evento de A', date: '2026-09-24', time: null, done: false, type: 'event' });
  stateA.transactions.push({ id: transactionId, description: 'Receita de A', date: '2026-09-24', amount: 10, category: 'Receita' });
  stateA.preferences = { activatedPlugins: ['clientes'] };

  const saved = await a.client.rpc('replace_business_state', { expected_revision: 0, snapshot: stateA });
  assert.ifError(saved.error);
  assert.equal(saved.data, 1);
  const loadedA = await a.client.rpc('get_business_state');
  assert.ifError(loadedA.error);
  assert.equal(loadedA.data.tasks[0].id, taskId);
  const repeated = await a.client.rpc('replace_business_state', { expected_revision: 1, snapshot: stateA });
  assert.ifError(repeated.error);
  assert.equal(repeated.data, 2);
  assert.equal((await a.client.rpc('get_business_state')).data.tasks.length, 1);
  assert.ifError((await a.client.from('profiles').update({ name: 'Conta de A' }).eq('id', a.id)).error);
  const secondDevice = createClient(url, publicKey, { auth: { persistSession: false } });
  assert.ifError((await secondDevice.auth.signInWithPassword({ email: a.email, password: a.password })).error);
  const reopened = await secondDevice.rpc('get_business_state');
  assert.ifError(reopened.error);
  assert.equal(reopened.data.calendar_events[0].id, eventId);
  assert.equal(reopened.data.transactions[0].id, transactionId);
  assert.deepEqual(reopened.data.preferences.activatedPlugins, ['clientes']);
  const profileOnSecondDevice = await secondDevice.from('profiles').select('name').eq('id', a.id).single();
  assert.ifError(profileOnSecondDevice.error);
  assert.equal(profileOnSecondDevice.data.name, 'Conta de A');
  const loadedB = await b.client.rpc('get_business_state');
  assert.ifError(loadedB.error);
  assert.deepEqual(loadedB.data.tasks, []);

  const bSelect = await b.client.from('tasks').select('id').eq('id', taskId);
  assert.ifError(bSelect.error);
  assert.deepEqual(bSelect.data, []);
  const bUpdate = await b.client.from('tasks').update({ data: { id: taskId, description: 'alterada' } }).eq('id', taskId).select('id');
  assert.ifError(bUpdate.error);
  assert.deepEqual(bUpdate.data, []);
  const bDelete = await b.client.from('tasks').delete().eq('id', taskId).select('id');
  assert.ifError(bDelete.error);
  assert.deepEqual(bDelete.data, []);
  const forgedInsert = await b.client.from('tasks').insert({ owner_id: a.id, id: `task_${randomUUID()}`, data: { id: `task_${randomUUID()}`, description: 'forged' } });
  assert.ok(forgedInsert.error, 'direct insert with another owner must fail');

  const crossReference = empty();
  crossReference.tasks.push({ id: `task_${randomUUID()}`, description: 'Referência cruzada', clientId, done: false, dueDate: null, priority: 'media', subtasks: [], tags: [], createdAt: new Date().toISOString() });
  const rejected = await b.client.rpc('replace_business_state', { expected_revision: 0, snapshot: crossReference });
  assert.ok(rejected.error, 'cross-owner FK must reject the write');
  const anonymousRead = await anonymous.rpc('get_business_state');
  assert.ok(anonymousRead.error, 'anonymous access must be rejected');
  const stale = await a.client.rpc('replace_business_state', { expected_revision: 0, snapshot: stateA });
  assert.ok(stale.error, 'stale revision must be rejected');
  const invalid = await a.client.rpc('replace_business_state', { expected_revision: 2, snapshot: { tasks: [{ id: taskId }] } });
  assert.ok(invalid.error, 'invalid snapshot must be rejected');
  const noSessionAi = await anonymous.functions.invoke('ai', { body: { action: 'status' } });
  assert.ok(noSessionAi.error, 'AI endpoint must reject unauthenticated callers');
  const storedKey = await a.client.functions.invoke('ai', { body: { action: 'set_key', key: 'A'.repeat(32) } });
  assert.ifError(storedKey.error);
  assert.equal(storedKey.data.configured, true);
  assert.ok(!JSON.stringify(storedKey.data).includes('A'.repeat(32)), 'secret must not be returned');
  for (let attempt = 0; attempt < 9; attempt++) assert.ifError((await a.client.functions.invoke('ai', { body: { action: 'set_key', key: 'B'.repeat(32) } })).error);
  const limitedAi = await a.client.functions.invoke('ai', { body: { action: 'set_key', key: 'C'.repeat(32) } });
  assert.equal(limitedAi.error?.context?.status, 429);
  const badPhoto = await a.client.functions.invoke('photo', { body: new Blob([new Uint8Array(64)], { type: 'image/webp' }), headers: { 'Content-Type': 'image/webp' } });
  assert.equal(badPhoto.error?.context?.status, 400);
  console.log('Testing direct oversized photo upload; the gateway may take a few minutes to respond.');
  const oversizedPhoto = await a.client.functions.invoke('photo', { body: new Blob([new Uint8Array(1048577)], { type: 'image/webp' }), headers: { 'Content-Type': 'image/webp' } });
  const oversizedStatus = oversizedPhoto.error?.context?.status ?? 200;
  assert.ok([413, 503].includes(oversizedStatus), `oversized direct upload must be rejected, got ${oversizedStatus}`);
  const photoAfterOversized = await admin.from('profiles').select('photo').eq('id', a.id).single();
  assert.ifError(photoAfterOversized.error);
  assert.equal(photoAfterOversized.data.photo, null, 'rejected upload must not update the profile');
  const storedPhotos = await admin.storage.from('profile-photos').list(a.id, { limit: 100 });
  assert.ifError(storedPhotos.error);
  assert.equal(storedPhotos.data.length, 0, 'rejected upload must not persist a photo');
  if (oversizedStatus === 503) console.warn('Oversized upload was rejected by the gateway (503); the Edge Function 413 response remains unverified.');
  const crossUpload = await b.client.storage.from('profile-photos').upload(`${a.id}/${randomUUID()}.webp`, new Uint8Array(32), { contentType: 'image/webp' });
  assert.ok(crossUpload.error, 'direct cross-owner upload must be denied');
  const deleted = await b.client.functions.invoke('delete-account', { body: { password: b.password } });
  assert.ifError(deleted.error);
  assert.equal(deleted.data.deleted, true);
  const afterDelete = await b.client.auth.signInWithPassword({ email: b.email, password: b.password });
  assert.ok(afterDelete.error, 'deleted Auth account must not log in');
  assert.ifError((await a.client.auth.signOut()).error);
  assert.ok((await a.client.rpc('get_business_state')).error, 'signed-out client must not access private data');
  console.log('Security smoke: A/B isolation, anonymous access, FK and revision passed.');
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
