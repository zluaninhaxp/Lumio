const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const compiled = new Module('system-bar-appearance');
compiled._compile(ts.transpileModule(fs.readFileSync('src/utils/systemBarAppearance.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, 'system-bar-appearance.cjs');
const { systemBarIconStyle, getSystemBarSurfaces } = compiled.exports;
const { configureModalSystemBars } = require('../plugins/withAndroidSystemBars.cjs');
const colors = { accent: '#00A878', bg: '#F3FFF9', appBackground: '#F8FCFA', bottomSurface: '#E6F7F1' };

test('icons choose stronger contrast for actual Lumio surfaces, white and dark backgrounds', () => {
  for (const surface of [...Object.values(colors), '#FFFFFF']) assert.equal(systemBarIconStyle(surface), 'dark');
  for (const surface of ['#202B38', '#111111', '#000000']) assert.equal(systemBarIconStyle(surface), 'light');
});
test('route policy follows introduction, tabs and standalone screen surfaces', () => {
  assert.deepEqual(getSystemBarSurfaces('/', colors), { top: colors.accent, bottom: colors.accent });
  for (const route of ['/welcome', '/login', '/register', '/auth', '/onboarding', '/onboarding-summary', '/celebration'])
    assert.deepEqual(getSystemBarSurfaces(route, colors), { top: colors.bg, bottom: colors.bg });
  for (const route of ['/chat', '/tarefas', '/financeiro', '/calendario', '/apps'])
    assert.deepEqual(getSystemBarSurfaces(route, colors), { top: colors.appBackground, bottom: colors.bottomSurface });
  for (const route of ['/account/profile', '/plugins/catalogo', '/plugins/financeiro', '/unknown'])
    assert.deepEqual(getSystemBarSurfaces(route, colors), { top: colors.appBackground, bottom: colors.appBackground });
});
test('Modal adaptation is idempotent, keeps existing lifecycle, and inherits window policy', () => {
  for (const newline of ['\n', '\r\n']) {
    const source = ['class MainActivity : ReactActivity() {', '  override fun onCreate(bundle: Bundle?) { super.onCreate(bundle) }', '}'].join(newline);
    const configured = configureModalSystemBars(source, '0.81.5');
    assert.equal(configureModalSystemBars(configured, '0.81.5'), configured);
    assert.ok(configured.includes('super.onCreate(bundle)'));
    assert.ok(configured.includes('super.onWindowFocusChanged(hasFocus)'));
    assert.ok(configured.includes('it.isShowing'));
    assert.ok(configured.includes('modalWindow.isNavigationBarContrastEnforced = window.isNavigationBarContrastEnforced'));
    assert.ok(configured.includes('modalController.isAppearanceLightNavigationBars = activityController.isAppearanceLightNavigationBars'));
  }
});
test('native changes require explicit review on RN upgrades or conflicting lifecycle code', () => {
  assert.throws(() => configureModalSystemBars('class MainActivity {}', '0.82.0'), /Review/);
  assert.throws(() => configureModalSystemBars('class MainActivity { override fun onWindowFocusChanged() {} }', '0.81.5'), /already handles/);
  assert.throws(() => configureModalSystemBars('invalid source', '0.81.5'), /Unexpected/);
});
test('native theme disables scrim only with explicit readable icon defaults; edge-to-edge remains enabled', async () => {
  const { getPrebuildConfigAsync } = require('@expo/prebuild-config');
  const { compileModsAsync } = require('expo/config-plugins');
  const config = await getPrebuildConfigAsync(process.cwd(), { platforms: ['android'] });
  await compileModsAsync(config.exp, { projectRoot: process.cwd(), introspect: true, platforms: ['android'], assertMissingModProviders: false });
  const mods = config.exp._internal.modResults.android;
  for (const name of ['AppTheme']) {
    const theme = mods.styles.resources.style.find(style => style.$.name === name);
    const items = Object.fromEntries(theme.item.map(item => [item.$.name, item._]));
    assert.equal(items['android:enforceNavigationBarContrast'], 'false');
    assert.equal(items['android:enforceStatusBarContrast'], 'false');
    assert.equal(items['android:windowLightNavigationBar'], 'true');
    assert.equal(items['android:windowLightStatusBar'], 'true');
    assert.equal(items['android:navigationBarColor'], undefined, 'do not paint an independent navigation stripe');
  }
  assert.equal(mods.gradleProperties.find(p => p.key === 'edgeToEdgeEnabled').value.trim(), 'true');
  const manifest = mods.manifest.manifest;
  const permission = manifest['uses-permission'].find(p => p.$['android:name'] === 'android.permission.RECORD_AUDIO');
  assert.notEqual(permission.$['tools:node'], 'remove', 'retain the prior voice fix');
});
