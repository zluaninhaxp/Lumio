const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { randomBytes } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');

function loader(stubs = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file,module);
    const code = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const req = name => name in stubs ? stubs[name] : name.startsWith('.') ? load(path.resolve(path.dirname(file), name.endsWith('.ts') ? name : name + '.ts')) : require(name);
    vm.runInNewContext(code, { module, exports: module.exports, require: req, console, Date, URL, URLSearchParams, TextEncoder, TextDecoder, AbortController, Request, Response, setTimeout,clearTimeout, ...globals }, { filename: file });
    return module.exports;
  }
  return load;
}
const clone = value => JSON.parse(JSON.stringify(value));
const freshStore = () => loader()('src/store/index.ts').useAppStore;
const baseSale = () => ({ items: [], total: 100, status: 'concluido', date: '2026-10-14', createdAt: '2026-10-14T12:00:00Z', employeeId: 'e' });

test('P1-11: an old deletion receipt preserves another account session and private state', async () => {
  for (const activeId of ['A', 'B', null]) {
    const calls = [], data = new Map([['@lumio/deletion-cleanup/p', JSON.stringify({userId:'A',email:'a@example.invalid'})]]);
    const storage = {getItem:async k=>data.get(k)??null,removeItem:async k=>data.delete(k)};
    const api = {auth:{getSession:async()=>({data:{session:activeId?{user:{id:activeId}}:null},error:null}),signOut:async()=>{calls.push('signOut');return {error:null};}}};
    const load = loader({'../lib/supabase':{supabase:api,isSupabaseConfigured:true,supabaseProjectScope:'p'},'./businessStateService':{businessStateService:{stop:()=>calls.push('stop'),clearPrivateState:()=>calls.push('clear')}},'./photoService':{photoService:{}},'./protectedStorage':{protectedStorage:storage},'./localPrivacy':{purgeAccountStorage:async(...args)=>calls.push(args)}});
    await load('src/services/authService.ts').authService.finishDeletionCleanup();
    assert.equal(calls.includes('signOut'),activeId==='A');
    assert.equal(calls.includes('stop'),activeId==='A');
    assert.equal(calls.includes('clear'),activeId==='A');
    assert.deepEqual(calls.at(-1),['p','A','a@example.invalid']);
    assert.equal(data.size,0);
  }
});

test('P1-03: task expense confirmation clears both pending flags from task and Finance', () => {
  const {isRealized}=loader()('src/services/financialRules.ts');
  for (const action of ['task','finance','supplier','event']) {
    const store=freshStore();
    store.setState({tasks:[{id:'task',done:false,calendarEventId:'ev'}],events:[{id:'ev',taskId:'task',source:'task',done:false}],transactions:[{id:'tx',taskId:'task',amount:-50,date:'2026-10-20',confirmed:false,supplierPaid:false}]});
    if(action==='task')store.getState().toggleTask('task');
    if(action==='finance')store.getState().markTransactionReceived('tx',true);
    if(action==='supplier')store.getState().markSupplierTransactionPaid('tx',true);
    if(action==='event')store.getState().updateEvent('ev',{done:true});
    assert.equal(isRealized(store.getState().transactions[0]),true,action);
    assert.equal(store.getState().tasks[0].done,true,action);
    assert.equal(store.getState().events[0].done,true,action);
    store.getState().toggleTask('task');
    assert.equal(isRealized(store.getState().transactions[0]),false,action+' undo');
    store.getState().toggleTask('task');
    assert.equal(isRealized(store.getState().transactions[0]),true,action+' redo');
  }
});

test('P1-11/P2-08: deletion drains mixed-extension pages and nested photos before deleting Auth',async()=>{
  let handler, deleted=false;
  const objects=Array.from({length:1000},(_,i)=>`A/${i}.jpg`).concat(['A/current.webp','A/old/avatar.png','B/preserve.webp']);
  const bucket={list:async prefix=>({data:[...new Set(objects.filter(p=>p.startsWith(prefix+'/')).map(p=>p.slice(prefix.length+1).split('/')[0]))].slice(0,1000).map(name=>({name,id:objects.includes(prefix+'/'+name)?name:null})),error:null}),remove:async paths=>{for(const p of paths)objects.splice(objects.indexOf(p),1);return {error:null};}};
  const admin={storage:{from:()=>bucket},auth:{getUser:async()=>({data:{user:{id:'A',email:'a@example.invalid'}}}),admin:{deleteUser:async()=>{assert.deepEqual(objects,['B/preserve.webp']);deleted=true;return {};}}}};
  loader({'npm:@supabase/supabase-js@2':{createClient:()=>({auth:{signInWithPassword:async()=>({data:{user:{id:'A'}}})}})},'../_shared/secure.ts':{admin,authorized:async()=> 'A',limited:async()=>true,readLimitedBody:async()=>JSON.stringify({password:'test123'}),json:(body,status=200)=>new Response(JSON.stringify(body),{status})}},{Deno:{serve:fn=>handler=fn,env:{get:()=> 'test'}}})('supabase/functions/delete-account/index.ts');
  const result=await handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer test'}}));
  assert.equal(result.status,200);assert.equal(deleted,true);
});

test('P0-02: deleting a customer/contract preserves paid and pending financial history', () => {
  const store = freshStore();
  store.setState({ clienteItems: [{ id:'c',name:'Cliente' }], contratos:[{id:'ctr',clientId:'c'}], transactions:[{id:'paid',clientId:'c',contractId:'ctr',amount:100,confirmed:true},{id:'pending',clientId:'c',contractId:'ctr',amount:100,confirmed:false}], atendimentos:[{id:'apt',clientId:'c',calendarEventId:'ev',status:'concluido'}], events:[{id:'ev',done:true},{id:'contract-due:ctr:2026-10-14'}] });
  store.getState().removeClienteItem('c');
  assert.equal(store.getState().transactions.length,2);
  for(const tx of store.getState().transactions) { assert.equal(tx.clientId,undefined); assert.equal(tx.contractId,undefined); assert.equal(tx.originArchived,true); }
  assert.equal(store.getState().atendimentos.length,1);
  assert.ok(store.getState().events.some(event=>event.id==='ev'));
  store.setState({contratos:[{id:'ctr2'}],transactions:[{id:'t',contractId:'ctr2',amount:100,confirmed:true}]});
  store.getState().removeContrato('ctr2'); assert.equal(store.getState().transactions[0].amount,100); assert.equal(store.getState().transactions[0].originArchived,true);
});
test('P1-01: actual store recalculates pending commissions; paid sale cannot be rewritten', () => {
  const store=freshStore(); store.setState({employeeItems:[{id:'e',commissionRate:10},{id:'f',commissionRate:20}]});
  const id=store.getState().addVenda(baseSale()); assert.ok(id);
  const commission=store.getState().commissions[0].id;
  store.getState().updatePedido(id,{total:200}); assert.equal(store.getState().commissions[0].amount,20); assert.equal(store.getState().commissions[0].id,commission);
  store.getState().updatePedido(id,{employeeId:'f'}); assert.equal(store.getState().commissions[0].employeeId,'f'); assert.equal(store.getState().commissions[0].amount,40);
  store.getState().updatePedido(id,{status:'cancelado'}); assert.equal(store.getState().commissions.length,0);
  store.getState().completePedido(id); store.getState().closeEmployeeCommission('f'); const before=clone(store.getState().commissions);
  assert.throws(()=>store.getState().updatePedido(id,{status:'cancelado'}),/comissão paga/);
  assert.throws(()=>store.getState().updatePedido(id,{total:300}),/comissão paga/);
  assert.deepEqual(clone(store.getState().commissions),before); assert.equal(store.getState().transactions[0].amount,200);
});
test('P1-04: derived transaction mutation/deletion is rejected atomically; explicit legacy date review is allowed', () => {
  const store=freshStore(); store.setState({transactions:[{id:'a',date:'2026-10-14',amount:100,orderId:'o'},{id:'b',date:'2026-10-14',amount:20},{id:'legacy',date:'14/10',amount:80,contractId:'ctr'}]});
  assert.throws(()=>store.getState().removeTransactions(['b','a']),/Vendas/); assert.equal(store.getState().transactions.length,3);
  assert.throws(()=>store.getState().updateTransaction('a',{amount:200}),/Vendas/);
  store.getState().updateTransaction('legacy',{date:'2025-10-14'}); assert.equal(store.getState().transactions[2].legacyDate,'14/10');
  store.getState().removeTransaction('b'); assert.equal(store.getState().transactions.length,2);
});
test('P1-02/03: complete dates, legacy ambiguity and realized/pending semantics agree', () => {
  const load=loader(), rules=load('src/services/financialRules.ts'), answer=load('src/engine/financialEngine/queryAnswer.ts').answerFinancialQuery;
  assert.equal(rules.financialDate({date:'14/10'}),null); assert.equal(rules.parseDateInput('14/10'),null);
  assert.equal(rules.parseDateInput('29/02/2025'),null); assert.equal(rules.parseDateInput('29/02/2024'),'2024-02-29');
  const txs=[{id:'old',date:'2025-10-14',amount:99,description:'Antigo'},{id:'new',date:'2026-10-14',amount:100,description:'Contrato',expectedDate:'2026-10-01',confirmed:true},{id:'pending',date:'2026-10-14',amount:-50,description:'Fornecedor',supplierPaid:false}];
  const text=answer({kind:'balance',period:'month'},txs,new Date('2026-10-14T12:00:00Z')); assert.match(text,/Entradas: R\$ 100,00/); assert.match(text,/Saídas: R\$ 0,00/);
  assert.equal(rules.isRealized(txs[1]),true); assert.equal(rules.isRealized(txs[2]),false);
});
test('P1-02/03: real Finance hook selects year and exposes unresolved history separately', () => {
  const txs=[{id:'old',date:'2025-10-14',amount:999,description:'Anterior'},{id:'new',date:'2026-10-14',amount:100,confirmed:true,expectedDate:'2026-10-01',description:'Contrato'},{id:'out',date:'2026-10-14',amount:-50,supplierPaid:false,description:'Pendente'},{id:'unknown',date:'14/10',amount:1000,description:'Sem ano'}];
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-14T12:00:00Z'])); } }
  const react={useState:v=>[typeof v==='function'?v():v,()=>{}],useMemo:fn=>fn(),useCallback:fn=>fn,useRef:v=>({current:v})};
  const load=loader({react,'react-native':{Platform:{OS:'android',select:options=>options.android??options.default}},'../store':{useAppStore:()=>({transactions:txs,financialExpenseCategories:[],financialIncomeCategories:[]})},'../services/confirmedAction':{confirmAction(){}}},{Date:FixedDate});
  const value=load('src/hooks/useFinanceState.ts').useFinanceState(); assert.equal(value.summary.entradas,100); assert.equal(value.summary.saidas,0); assert.equal(value.summary.saldo,100);
  assert.match(value.sections.at(-1).title,/Ano não informado/); assert.equal(value.sections.at(-1).data[0].id,'unknown');
});
test('P1-05: linked independent-field changes conflict, unrelated transactions still merge', () => {
  const {mergeSnapshots,resolveWithRemote}=loader()('src/services/syncMerge.ts');
  const base={orders:[{id:'o',total:100}],transactions:[{id:'t',orderId:'o',amount:100}],commissions:[{id:'cm',orderId:'o',amount:10,paid:false}]};
  const local=clone(base);local.orders[0].total=200;local.transactions[0].amount=200; local.transactions.push({id:'unrelated',amount:5});
  const remote=clone(base);remote.commissions[0].paid=true;
  assert.ok(mergeSnapshots(base,local,remote).conflicts.length); const chosen=resolveWithRemote(base,local,remote);
  assert.equal(chosen.orders[0].total,100); assert.equal(chosen.commissions[0].paid,true); assert.ok(chosen.transactions.some(tx=>tx.id==='unrelated'));
});
test('P2-06: billing retains day 31 and handles leap years; changing schedule preserves received history', () => {
  const rules=loader()('src/services/financialRules.ts'); assert.equal(rules.advanceBillingDate('2025-01-31',1,'2025-01-31'),'2025-02-28'); assert.equal(rules.advanceBillingDate('2025-02-28',1,'2025-01-31'),'2025-03-31'); assert.equal(rules.advanceBillingDate('2024-01-31',1,'2024-01-31'),'2024-02-29');
  const store=freshStore();store.setState({clienteItems:[{id:'c'}],contratos:[{id:'ctr',clientId:'c',value:100,period:'mensal',startDate:'2026-01-31',nextBillingDate:'2026-03-31',status:'ativo'}],transactions:[{id:'paid',contractId:'ctr',confirmed:true,expectedDate:'2026-01-31',amount:100},{id:'pending',contractId:'ctr',confirmed:false,expectedDate:'2026-02-28',amount:100}]});
  store.getState().updateContrato('ctr',{value:200}); assert.equal(store.getState().transactions.length,1); assert.equal(store.getState().transactions[0].amount,100); assert.equal(store.getState().contratos[0].nextBillingDate,'2026-02-28');
});

function persistenceFixture() {
  const source=fs.readFileSync('scripts/persistence.test.cjs','utf8').split("test('success is reported")[0];
  const context={require,console}; vm.runInNewContext(source+';globalThis.fixtureFactory=fixture;',context); return context.fixtureFactory;
}
test('P0-03: rejected chat operation rolls back only its preparation and permits future commits',async()=>{
  const f=persistenceFixture()();await f.start(); const before=f.businessStateService.capturePreparation();
  f.store.setState({tasks:[{id:'rejected',description:'Rejected'}]});f.businessStateService.stageChatPreparation(before,['m']);
  await f.chat.stage([{id:'m',type:'user',text:'test',timestamp:new Date()}]);
  f.store.setState({tasks:[...f.state.tasks,{id:'unrelated',description:'Keep'}]});f.controls.rejectValidation='23514';
  await assert.rejects(f.businessStateService.commit()); assert.equal(f.state.tasks.length,1);assert.equal(f.state.tasks[0].id,'unrelated');assert.equal(f.chat.hasPending(),false);
  f.controls.rejectValidation=null;await f.businessStateService.commit();assert.equal(f.row().snapshot.tasks[0].id,'unrelated');
});
test('P0-03/P1-06: restart displays safe pending messages; rejection preparation survives reload',async()=>{
  const factory=persistenceFixture(),f=factory();await f.start();const before=f.businessStateService.capturePreparation();f.store.setState({tasks:[{id:'t',description:'Pending'}]});f.businessStateService.stageChatPreparation(before,['m']);await f.chat.stage([{id:'m',type:'bot',text:'Pendente',timestamp:new Date(),quickActions:[{label:'Never execute',value:'add_task'}]}]);f.controls.offline=true;await assert.rejects(f.businessStateService.commit());
  const next=factory(f.shared);await next.start();assert.equal(next.state.chatHistory[0].pending,true);assert.equal(next.state.chatHistory[0].historical,true);
  next.controls.rejectValidation='23514';await assert.rejects(next.businessStateService.commit());assert.equal(next.state.tasks.length,0);assert.equal(next.state.chatHistory.length,0);
});
test('P0-03: preflight invalid input never reaches the remote',async()=>{
  const f=persistenceFixture()();await f.start();f.store.setState({clienteItems:[{id:'too-long',name:'x'.repeat(201)}]});await assert.rejects(f.businessStateService.commit(),/nome/);assert.equal(f.controls.writes,0);
  assert.throws(()=>freshStore().getState().addClienteItem({name:'x'.repeat(201)}),/200/);
});

function cryptoFixture() {
  const data=new Map(), secrets=new Map();const noop={};
  const load=loader({'@react-native-async-storage/async-storage':{__esModule:true,default:noop},'expo-secure-store':noop,'expo-crypto':noop,'react-native':{Platform:{OS:'android'}}});
  const storage=load('src/services/protectedStorage.ts').createProtectedStorage({get:async k=>data.get(k)??null,set:async(k,v)=>data.set(k,v),remove:async k=>data.delete(k),keyGet:async k=>secrets.get(k)??null,keySet:async(k,v)=>secrets.set(k,v),keyRemove:async k=>secrets.delete(k),random:async n=>new Uint8Array(randomBytes(n)),keys:async()=>[...data.keys()]});return {storage,data,secrets};
}
test('P1-10: actual AES-GCM storage migrates plaintext, verifies ciphertext and prevents cross-key reuse',async()=>{
  const f=cryptoFixture();f.data.set('A','{"token":"test-only"}');assert.equal(await f.storage.getItem('A'),'{"token":"test-only"}');assert.ok(!f.data.get('A').includes('test-only'));
  const first=f.data.get('A');await f.storage.setItem('A','{"token":"test-only"}');assert.notEqual(f.data.get('A'),first);
  f.data.set('B',f.data.get('A'));await assert.rejects(f.storage.getItem('B'),/Proteção local/);
  const broken=JSON.parse(f.data.get('A'));broken.ciphertext='00'+broken.ciphertext.slice(2);f.data.set('A',JSON.stringify(broken));await assert.rejects(f.storage.getItem('A'),/verificar/);assert.ok(f.data.has('A'));
});
test('P1-10/11: encrypted deletion removes ciphertext and protected key; no plaintext fallback on key loss',async()=>{
  const f=cryptoFixture();await f.storage.setItem('A','{"draft":"test"}');assert.equal(f.secrets.size,1);await f.storage.removeItem('A');assert.equal(f.data.size,0);assert.equal(f.secrets.size,0);
  await f.storage.setItem('A','{"draft":"test"}');f.secrets.clear();await assert.rejects(f.storage.getItem('A'));assert.ok(f.data.has('A'));
});
test('P1-12: auxiliary drafts are cleared between identities, including logout',()=>{
  const load=loader(),scope=load('src/services/accountScope.ts'),draft=load('src/utils/relationDraft.ts');scope.setDraftIdentity('p','A');draft.saveRelationDraft('sales',{description:'Private A'});assert.equal(draft.getRelationDraft('sales').description,'Private A');scope.setDraftIdentity('p','B');assert.equal(draft.getRelationDraft('sales'),null);scope.setDraftIdentity('p',null);draft.saveRelationDraft('sales',{description:'No owner'});assert.equal(draft.getRelationDraft('sales'),null);
});
test('P1-11: deletion purge removes only the requested user legacy/journal keys',async()=>{
  const data=new Map([['@lumio/session',JSON.stringify({userId:'B'})],['@lumio/users',JSON.stringify([{id:'legacyA',email:'a@example.invalid'},{id:'B',email:'b@example.invalid'}])],['@lumio/onboarding/legacyA','old'],['@lumio/unsaved/p/A','private'],['@lumio/unsaved/p/B','preserve']]);const storage={getItem:async k=>data.get(k)??null,setItem:async(k,v)=>data.set(k,v),removeItem:async k=>data.delete(k),getAllKeys:async()=>[...data.keys()]};
  const load=loader({'@react-native-async-storage/async-storage':{__esModule:true,default:storage},'./protectedStorage':{protectedStorage:storage}});await load('src/services/localPrivacy.ts').purgeAccountStorage('p','A','a@example.invalid');assert.equal(data.has('@lumio/unsaved/p/A'),false);assert.equal(data.has('@lumio/onboarding/legacyA'),false);assert.equal(data.get('@lumio/unsaved/p/B'),'preserve');assert.equal(JSON.parse(data.get('@lumio/users')).length,1);
  assert.equal(JSON.parse(data.get('@lumio/session')).userId,'B');
  data.set('@lumio/session',JSON.stringify({userId:'B'}));await load('src/services/localPrivacy.ts').purgeAccountStorage('p','B');assert.equal(data.has('@lumio/session'),false);
});
test('P1-07: real global fetch preserves AI deadline and propagates caller cancellation',async()=>{
  const delays=[];let aborted=false;const load=loader({}, {fetch:async (_input,init)=>{aborted=init.signal.aborted;return new Response('{}');},setTimeout:(_fn,delay)=>{delays.push(delay);return 1;},clearTimeout(){}});const fetcher=load('src/lib/authFetch.ts').authFetch;
  await fetcher('https://example.invalid/functions/v1/ai');assert.equal(delays[0],150000);const controller=new AbortController();controller.abort();await fetcher('https://example.invalid/auth/v1/user',{signal:controller.signal});assert.equal(aborted,true);assert.equal(delays[1],20000);
});
test('P1-09/14: institution is factual and PKCE callbacks reject other origins/errors',()=>{
  const load=loader({'../lib/supabase':{supabase:{}}}),links=load('src/services/authLinks.ts'),privacy=load('src/constants/privacy.ts');
  assert.equal(links.parseAuthLink('lumio://auth-callback?code=test&intent=recovery').recovery,true);assert.throws(()=>links.parseAuthLink('https://example.invalid/auth-callback?code=test'));assert.throws(()=>links.parseAuthLink('lumio://evil/auth-callback?code=test'));assert.throws(()=>links.parseAuthLink('lumio://auth-callback?error=expired'));
  assert.equal(privacy.PRIVACY_CONTACT,'luanacastro325@gmail.com');assert.ok(privacy.PRIVACY_SECTIONS.some(row=>row.text.includes('90 dias')));
});
test('P1-14: real auth service sends neutral recovery/confirmation and uses PKCE exchange',async()=>{
  const calls=[];const api={auth:{resend:async value=>{calls.push(value);return {};},resetPasswordForEmail:async(email,options)=>{calls.push({email,options});return {};},exchangeCodeForSession:async code=>({data:{session:{user:{id:'A'}}}}),updateUser:async value=>{calls.push(value);return {};}}};
  const load=loader({'../lib/supabase':{supabase:api,isSupabaseConfigured:true,supabaseProjectScope:'p'},'./businessStateService':{businessStateService:{}},'./photoService':{photoService:{}},'./localPrivacy':{},'./protectedStorage':{}});const auth=load('src/services/authService.ts').authService;
  await auth.requestPasswordRecovery('a@example.invalid');await auth.resendConfirmation('a@example.invalid');assert.equal(calls[0].options.redirectTo,'lumio://auth-callback?intent=recovery');assert.equal(calls[1].options.emailRedirectTo,'lumio://auth-callback');assert.equal(await load('src/services/authLinks.ts').exchangeAuthLink('lumio://auth-callback?code=test&intent=recovery'),true);await assert.rejects(auth.completePasswordRecovery('123'));
});

test('P0-01/P1-13: every migration, RLS and strict RPC run in isolated PostgreSQL; NULL/missing payload preserves data',async()=>{
  const db=new PGlite();try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated')$$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key,bucket_id text);alter table storage.objects enable row level security;
      grant usage on schema public,auth,storage to anon,authenticated,service_role;
      alter default privileges in schema public grant all on tables to anon,authenticated;`);
    for(const file of fs.readdirSync('supabase/migrations').filter(name=>name.endsWith('.sql')).sort())await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8').replace('create extension if not exists pgcrypto;',''));
    const uid='00000000-0000-4000-8000-000000000001';await db.query("insert into auth.users(id,email) values($1,'test@example.invalid')",[uid]);await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
    const snapshot=Object.fromEntries(loader()('src/services/snapshotValidation.ts').businessCollections.map(key=>[key,[]]));snapshot.preferences={};snapshot.tasks=[{id:'preserve',description:'Preserve'}];await db.query('select public.replace_business_state($1,$2::jsonb)',[0,JSON.stringify(snapshot)]);
    for(const [rev,payload] of [[null,snapshot],[1,{preferences:{}}],[1,null],[1,{...snapshot,tasks:null}],[1,{...snapshot,preferences:[]}],[1,{...snapshot,tasks:[{description:'No id'}]}],[1,{...snapshot,tasks:[{id:'x',description:'a'},{id:'x',description:'b'}]}]]) {
      await assert.rejects(db.query('select public.replace_business_state($1,$2::jsonb)',[rev,JSON.stringify(payload)]));assert.equal((await db.query('select count(*)::int as n from public.tasks')).rows[0].n,1);
    }
    await assert.rejects(db.query('select public.commit_lumio_state($1,$2::jsonb,$3::jsonb)',[1,JSON.stringify(snapshot),null]));
    await assert.rejects(db.query("select public.commit_lumio_state($1,$2::jsonb,'[]'::jsonb,null,$3)",[1,JSON.stringify(snapshot),null]));
    await assert.rejects(db.query('select * from public.ai_credentials'));
    assert.equal((await db.query("select has_table_privilege('authenticated','public.orders','TRUNCATE') as allowed")).rows[0].allowed,false);
    assert.equal((await db.query("select has_table_privilege('anon','public.tasks','SELECT') as allowed")).rows[0].allowed,false);
    const receipt=await db.query("select public.commit_lumio_state(1,$1::jsonb,'[]'::jsonb,null,'stable') as revision",[JSON.stringify(snapshot)]);assert.equal(receipt.rows[0].revision,2);assert.equal((await db.query("select public.commit_lumio_state(1,$1::jsonb,'[]'::jsonb,null,'stable') as revision",[JSON.stringify(snapshot)])).rows[0].revision,2);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",['00000000-0000-4000-8000-000000000002']);assert.equal((await db.query('select count(*)::int as n from public.tasks')).rows[0].n,0);
  } finally {await db.close();}
});

test('P1-10: large encrypted journals use bounded chunks and deletion removes all parts',async()=>{
 const f=cryptoFixture(),value=JSON.stringify({content:'x'.repeat(300000)});await f.storage.setItem('A',value);const manifest=JSON.parse(f.data.get('A'));assert.equal(manifest.lumioChunks,1);assert.equal(await f.storage.getItem('A'),value);for(const item of f.data.values())assert.ok(item.length<=256000);await f.storage.removeItem('A');assert.equal(f.data.size,0);
});

test('P1-03/04: payment status propagates in both directions without destroying the transaction',()=>{
 const store=freshStore();store.setState({tasks:[{id:'task',done:false,calendarEventId:'ev'}],events:[{id:'ev',taskId:'task',source:'task',done:false}],transactions:[{id:'tx',taskId:'task',date:'2026-10-20',amount:-50,supplierPaid:false,supplierId:'supplier'}],fornecedorItems:[{id:'supplier'}]});
 store.getState().toggleTask('task');assert.equal(store.getState().transactions[0].supplierPaid,true);assert.equal(store.getState().events[0].done,true);
 store.getState().markSupplierTransactionPaid('tx',false);assert.equal(store.getState().tasks[0].done,false);assert.equal(store.getState().events[0].done,false);
 store.getState().updateEvent('ev',{done:true});assert.equal(store.getState().transactions[0].supplierPaid,true);
 store.getState().markSupplierTransactionPaid('tx',false);store.getState().removeFornecedorItem('supplier');assert.equal(store.getState().transactions[0].supplierPaid,false);assert.equal(store.getState().transactions[0].supplierId,undefined);
});

test('P0-03: unsafe rollback offers explicit group recovery and preserves an encrypted-ready rejection copy',async()=>{
 const f=persistenceFixture()();await f.start();const before=f.businessStateService.capturePreparation();f.store.setState({tasks:[{id:'t',description:'First'}]});f.businessStateService.stageChatPreparation(before,['m']);await f.chat.stage([{id:'m',type:'user',text:'Original attempt',timestamp:new Date()}]);f.store.setState({tasks:[{id:'t',description:'Later overlapping edit'},{id:'other',description:'Unrelated'}]});f.controls.rejectValidation='23514';await assert.rejects(f.businessStateService.commit());assert.equal(f.businessSyncStatus.get().status,'conflict');assert.equal(f.businessStateService.canKeepLocal(),false);assert.ok([...f.shared.storage.keys()].some(key=>key.startsWith('@lumio/rejected/')));
 f.controls.rejectValidation=null;await f.businessStateService.resolveConflict('remote');assert.deepEqual(clone(f.state.tasks).map(task=>task.id),['other']);assert.equal(f.row().snapshot.tasks[0].id,'other');
});

test('P1-04: generated contract/delivery/appointment events must be changed through their source',()=>{
 const store=freshStore();store.setState({events:[{id:'contract-due:ctr:2026-10-14',done:false},{id:'delivery',done:false}],entregas:[{id:'d',calendarEventId:'delivery'}]});
 assert.throws(()=>store.getState().toggleEvent('contract-due:ctr:2026-10-14'),/Contratos/);assert.throws(()=>store.getState().removeEvent('delivery'),/Entregas/);assert.equal(store.getState().events.length,2);
});
