const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture() {
  const auth = { ready: true, initializationError: null, async retryInitialization() { calls.push('initialize'); } };
  const slots = [], timers = new Map(), effects = [], calls = [];
  let cursor = 0, id = 0, status = { status: 'ready' }, listener;
  const hooks = {
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
    useEffect(fn, deps) {
      const i = cursor++, previous = slots[i];
      if (!previous || deps.some((v, j) => !Object.is(v, previous.deps[j]))) {
        previous?.cleanup?.();
        effects.push(() => { slots[i] = { deps, cleanup: fn() }; });
      }
    },
  };
  const stubs = {
    react: hooks,
    'react/jsx-runtime': { Fragment: 'Fragment', jsx: (type, props) => ({ type, props }) },
    'expo-router': { usePathname: () => '/chat' },
    'expo-splash-screen': { hideAsync: async () => calls.push('hide') },
    '../hooks/useAuth': { useAuth: () => auth },
    '../services/businessStateService': {
      businessStateService: { async commit() { calls.push('commit'); status = { status: 'error' }; listener?.(status); throw Error('network'); } },
      businessSyncStatus: { get: () => status, subscribe(fn) { listener = fn; return () => { listener = null; }; } },
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/persistence-feedback.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module, exports: module.exports, require(name) { assert.ok(name in stubs, 'No visual persistence dependency: ' + name); return stubs[name]; },
    setTimeout(fn, delay) { timers.set(++id, { fn, delay }); return id; }, clearTimeout(key) { timers.delete(key); },
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  });
  const children = { screen: 'unchanged' };
  function render() {
    cursor = 0;
    const tree = module.exports.PersistenceFeedback({ children });
    effects.splice(0).forEach(fn => fn());
    assert.equal(tree.type, 'Fragment');
    assert.equal(tree.props.children, children, 'no banner, recovery screen, alert or retry control');
    return tree;
  }
  render();
  return { auth, calls, timers, render, status(value) { status = { status: value }; listener(status); render(); },
    async tick() { const [key, timer] = timers.entries().next().value; timers.delete(key); timer.fn(); await new Promise(resolve => setImmediate(resolve)); render(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test('all persistence statuses stay invisible, including recovered drafts and conflicts', () => {
  const f = fixture();
  for (const status of ['loading', 'saving', 'error', 'conflict', 'warning', 'ready']) f.status(status);
  assert.equal(f.calls.length, 0);
});

test('connection failures retry internally with backoff; conflicts never pick a data winner', async () => {
  const f = fixture(); f.status('error');
  assert.equal([...f.timers.values()][0].delay, 5000);
  await f.tick();
  assert.equal(f.calls[0], 'commit');
  assert.equal([...f.timers.values()][0].delay, 10000);
  f.status('conflict');
  assert.equal(f.timers.size, 0);
  f.status('ready'); f.status('error');
  assert.equal([...f.timers.values()][0].delay, 5000);
  f.unmount(); assert.equal(f.timers.size, 0);
});

test('cold-start initialization retries without exposing its error or clearing identity', async () => {
  const f = fixture(); f.auth.ready = false; f.auth.initializationError = 'private backend details'; f.render();
  await f.tick();
  assert.deepEqual(f.calls, ['initialize']);
  assert.equal(f.auth.initializationError, 'private backend details');
});

test('Chat keeps failure state and idempotent retry logic internally without retry banners', () => {
  const source = fs.readFileSync('app/(tabs)/chat.tsx', 'utf8');
  assert.ok(!source.includes('Não enviada. Tentar novamente'));
  assert.ok(!source.includes('Não foi possível concluir o envio. Tentar novamente'));
  assert.match(source, /void retryMessages\(\)/);
  assert.match(source, /retryableSendFailure.current = false/);
  const hook = fs.readFileSync('src/hooks/use-confirmed-save.ts', 'utf8');
  assert.ok(!hook.includes('AppAlert'));
  assert.match(hook, /await businessStateService.commit\(\)/);
  assert.match(hook, /cancelRejectedPreparation/);
});
