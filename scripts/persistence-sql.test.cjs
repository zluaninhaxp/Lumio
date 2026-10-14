const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const A = '00000000-0000-4000-8000-000000000001', B = '00000000-0000-4000-8000-000000000002';
const collections = ['clients', 'suppliers', 'employees', 'stock_items', 'catalog_items', 'orders', 'quotes', 'contracts', 'tasks', 'calendar_events', 'transactions', 'stock_movements', 'deliveries', 'appointments', 'commissions', 'generic_plugin_items'];
const snapshot = () => ({ ...Object.fromEntries(collections.map(key => [key, []])), preferences: { activatedPlugins: [], pluginOrder: [] } });
const message = id => ({ id, type: 'bot', text: 'Test', timestamp: '2026-10-14T00:00:00.000Z', cards: [{ kind: 'task', title: 'Test' }] });
test('incremental migrations: real PostgreSQL transaction, RLS, revision, idempotency and canonical preferences', async () => {
  const db = new PGlite();
  try {
    // Supabase auth/default grants emulated locally; no production URL or credentials are used.
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to anon,authenticated;
      grant execute on function auth.uid() to anon,authenticated;
      alter default privileges in schema public grant select,insert,update,delete on tables to authenticated;`);
    for (const filename of ['0001_auth_onboarding.sql', '0002_profile_fields.sql', '0003_learned_intent_markers.sql', '0004_business_state.sql', '0007_chat_history.sql']) {
      // gen_random_uuid is built into PostgreSQL. PGlite doesn't require the pgcrypto extension here.
      const sql = fs.readFileSync('supabase/migrations/' + filename, 'utf8').replace('create extension if not exists pgcrypto;', '');
      await db.exec(sql);
    }
    await db.query(`insert into auth.users(id,email) values ($1,'a@example.invalid'),($2,'b@example.invalid')`, [A, B]);
    await db.query(`insert into public.onboarding_records(user_id,responses,activated_plugins) values ($1,'{"__lumioPluginOrder":["clientes"]}',array['clientes']),($2,'{}',array['estoque'])`, [A, B]);
    await db.query(`insert into public.business_preferences(owner_id,data) values ($1,'{"activatedPlugins":["catalogo"],"businessName":"Existing"}')`, [A]);
    await db.exec(fs.readFileSync('supabase/migrations/0008_canonical_preferences.sql', 'utf8'));
    await db.exec(fs.readFileSync('supabase/migrations/0009_commit_receipts.sql', 'utf8'));
    const seeded = (await db.query('select data from public.business_preferences where owner_id=$1', [A])).rows[0].data;
    assert.deepEqual(seeded.activatedPlugins, ['catalogo']); assert.equal(seeded.businessName, 'Existing'); assert.deepEqual(seeded.pluginOrder, ['clientes']);
    await db.exec('set role authenticated'); await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [A]);
    let requestCounter = 0;
    const call = async (revision, state, messages = [], onboarding = null) => db.query('select public.commit_lumio_state($1,$2::jsonb,$3::jsonb,$4::jsonb,$5) as revision', [revision, JSON.stringify(state), JSON.stringify(messages), onboarding ? JSON.stringify(onboarding) : null, 'request-' + ++requestCounter]);
    const state = snapshot(); state.tasks = [{ id: 'task-one', description: 'Test', done: false }]; state.preferences = { activatedPlugins: ['clientes'], pluginOrder: ['clientes'], businessName: 'Canonical' };
    assert.equal((await call(0, state, [message('msg-one')], { responses: { business: 'Test' }, context: {}, structuredProfile: {} })).rows[0].revision, 1);
    assert.equal((await db.query('select count(*)::int as n from public.tasks')).rows[0].n, 1);
    assert.equal((await db.query('select count(*)::int as n from public.chat_messages')).rows[0].n, 1);
    assert.equal((await db.query('select onboarding_completed from public.profiles where id=$1', [A])).rows[0].onboarding_completed, true);
    const replay = await db.query('select public.commit_lumio_state($1,$2::jsonb,$3::jsonb,$4::jsonb,$5) as revision', [0, JSON.stringify(state), JSON.stringify([message('msg-one')]), JSON.stringify({ responses: { business: 'Test' }, context: {}, structuredProfile: {} }), 'request-1']);
    assert.equal(replay.rows[0].revision, 1);
    await call(1, state, [message('msg-one')]); assert.equal((await db.query('select count(*)::int as n from public.chat_messages')).rows[0].n, 1);
    await assert.rejects(call(0, state), error => error.code === 'PT409');
    await assert.rejects(db.query('insert into public.chat_messages(owner_id,id,payload) values ($1,$2,$3)', [A, 'direct', JSON.stringify(message('direct'))]), error => error.code === '42501');
    const invalid = snapshot(); invalid.tasks = [{ id: 'bad', description: 'Test', clientId: 'missing-client' }];
    await assert.rejects(call(2, invalid, [message('should-not-exist')]), error => error.code === '23503');
    assert.equal((await db.query('select count(*)::int as n from public.chat_messages')).rows[0].n, 1);
    assert.equal((await db.query('select public.get_business_state() as data')).rows[0].data.revision, 2);
    await assert.rejects(call(2, state, [{ ...message('bad-payload'), apiKey: 'unnecessary' }]), error => error.code === '23514');
    assert.equal((await db.query('select public.get_business_state() as data')).rows[0].data.revision, 2);
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [B]);
    assert.equal((await db.query('select count(*)::int as n from public.chat_messages')).rows[0].n, 0);
    assert.equal((await db.query('select count(*)::int as n from public.tasks')).rows[0].n, 0);
    await call(0, snapshot(), [message('b-message')]);
    const ids = (await db.query('select owner_id from public.chat_messages')).rows; assert.deepEqual(ids.map(row => row.owner_id), [B]);
    await db.exec('reset role; set role anon'); await db.query(`select set_config('request.jwt.claim.sub','',false)`);
    await assert.rejects(db.query('select public.get_business_state()'), error => error.code === '42501');
    await assert.rejects(db.query('select * from public.chat_messages'), error => error.code === '42501');
    await assert.rejects(call(0, snapshot()), error => error.code === '42501');
  } finally { await db.close(); }
});
