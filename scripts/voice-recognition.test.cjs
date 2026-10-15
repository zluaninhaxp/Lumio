const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const compiled = new Module('voice-controller');
compiled._compile(ts.transpileModule(fs.readFileSync('src/services/voiceRecognition.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, 'voice-controller.cjs');
const { VoiceRecognition } = compiled.exports;
function setup(permission = { granted: true, canAskAgain: true }) {
  const listeners = new Map(), statuses = [], captures = [], partials = [], calls = [];
  const module = {
    getPermissionsAsync: async () => { calls.push('check'); return permission; },
    requestPermissionsAsync: async () => { calls.push('request'); return { granted: true }; },
    isRecognitionAvailable: () => true,
    start: () => calls.push('start'), stop: () => calls.push('stop'), abort: () => calls.push('abort'),
    addListener: (name, callback) => { listeners.set(name, callback); return { remove: () => listeners.delete(name) }; },
  };
  const controller = new VoiceRecognition(module, s => statuses.push(s), t => captures.push(t), t => partials.push(t));
  return { controller, module, listeners, statuses, captures, partials, calls, emit: (name, event) => listeners.get(name)?.(event) };
}
test('fresh install requests once, starts after grant on the same press, ignores rapid taps', async () => {
  const s = setup({ granted: false, canAskAgain: true });
  try { await Promise.all([s.controller.press(), s.controller.press()]); assert.deepEqual(s.calls, ['check', 'request', 'start']); }
  finally { s.controller.dispose(); }
});
test('granted permission skips dialog; partial and final text delivered once; stop waits for end', async () => {
  const s = setup();
  try {
    await s.controller.press(); s.emit('start');
    s.emit('result', { isFinal: false, results: [{ transcript: 'olá' }] });
    await s.controller.press(); await s.controller.press();
    s.emit('result', { isFinal: true, results: [{ transcript: 'olá mundo' }] }); s.emit('end');
    assert.deepEqual(s.calls, ['check', 'start', 'stop']);
    assert.deepEqual(s.captures, ['olá mundo']); assert.deepEqual(s.partials, ['olá', 'olá mundo']);
    assert.equal(s.listeners.size, 0);
  } finally { s.controller.dispose(); }
});
test('simple denial permits a later retry; blocked permission never prompts', async () => {
  for (const canAskAgain of [true, false]) {
    const s = setup({ granted: false, canAskAgain });
    s.module.requestPermissionsAsync = async () => { s.calls.push('request'); return { granted: false, canAskAgain }; };
    try {
      await s.controller.press(); await s.controller.press();
      assert.equal(s.statuses.at(-1).state, canAskAgain ? 'denied' : 'blocked');
      assert.equal(s.calls.filter(c => c === 'request').length, canAskAgain ? 2 : 0);
      assert.ok(!s.calls.includes('start'));
    } finally { s.controller.dispose(); }
  }
});
test('leaving during permission dialog prevents late start and callbacks', async () => {
  const s = setup({ granted: false, canAskAgain: true }); let grant;
  s.module.requestPermissionsAsync = () => new Promise(resolve => { grant = resolve; });
  const press = s.controller.press(); await Promise.resolve(); s.controller.dispose();
  grant({ granted: true }); await press; assert.ok(!s.calls.includes('start'));
});
test('native errors stay distinct, suppress final capture, and release listeners on end', async () => {
  for (const error of ['busy', 'no-speech', 'speech-timeout', 'client', 'aborted', 'not-allowed']) {
    const s = setup();
    try {
      await s.controller.press(); s.emit('result', { results: [{ transcript: 'partial' }] });
      s.emit('error', { error, message: 'native details' }); s.emit('end');
      assert.equal(s.captures.length, 0); assert.equal(s.listeners.size, 0);
      if (error !== 'aborted') assert.equal(s.statuses.at(-1).code, error);
    } finally { s.controller.dispose(); }
  }
});
test('unavailable service, initialization failure, singleton ownership and cleanup', async () => {
  const s = setup(), other = setup();
  try {
    await s.controller.press(); await other.controller.press(); assert.equal(other.statuses.at(-1).code, 'busy');
    s.controller.dispose(); assert.ok(s.calls.includes('abort')); assert.equal(s.listeners.size, 0);
    other.module.isRecognitionAvailable = () => false;
    await other.controller.press(); assert.equal(other.statuses.at(-1).state, 'unavailable');
    other.module.isRecognitionAvailable = () => true;
    other.module.start = () => { throw Error('native init'); };
    await other.controller.press(); assert.equal(other.statuses.at(-1).code, 'initialization');
    assert.equal(other.listeners.size, 0);
  } finally { s.controller.dispose(); other.controller.dispose(); }
});
test('Expo plugins preserve RECORD_AUDIO and recognition service query', async () => {
  const expoRequire = Module.createRequire(require.resolve('expo/package.json'));
  const { getPrebuildConfigAsync } = expoRequire('@expo/prebuild-config');
  const { compileModsAsync } = require('expo/config-plugins');
  const config = await getPrebuildConfigAsync(process.cwd(), { platforms: ['android', 'ios'] });
  await compileModsAsync(config.exp, { projectRoot: process.cwd(), introspect: true, platforms: ['android', 'ios'], assertMissingModProviders: false });
  const manifest = config.exp._internal.modResults.android.manifest.manifest;
  const permission = manifest['uses-permission'].find(p => p.$['android:name'] === 'android.permission.RECORD_AUDIO');
  assert.ok(permission); assert.notEqual(permission.$['tools:node'], 'remove');
  assert.ok(JSON.stringify(manifest.queries).includes('android.speech.RecognitionService'));
});
