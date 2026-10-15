const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const flatten = s => Array.isArray(s) ? Object.assign({}, ...s.map(flatten)) : s || {};
function load(file, require) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module, exports: module.exports, require });
  return module.exports;
}
const native = { TextInput: 'NativeInput', Platform: { OS: 'android', Version: 35 }, StyleSheet: { create: s => s, flatten } };
const theme = load('src/constants/theme.ts', () => native);
function fixture(props = {}) {
  let focused = false;
  const ref = { current: null };
  const { FormTextInput } = load('src/components/form-text-input.tsx', name => {
    if (name === 'react') return { forwardRef: fn => fn, useState: () => [focused, v => { focused = v; }] };
    if (name === 'react-native') return native;
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
    return theme;
  });
  return { render(changes = {}) { props = { ...props, ...changes }; return FormTextInput(props, ref); }, ref };
}
test('focus changes only the existing border color and blur restores the original styles', () => {
  const style = { ...theme.SurfaceStyles.control, minHeight: 48, padding: 12 };
  const app = fixture({ style });
  let input = app.render(); assert.equal(flatten(input.props.style).borderColor, theme.SurfaceColors.controlBorder);
  input.props.onFocus({}); input = app.render();
  assert.equal(flatten(input.props.style).borderColor, theme.SurfaceColors.focusBorder);
  assert.equal(flatten(input.props.style).padding, 12); assert.equal(flatten(input.props.style).borderWidth, 1);
  input.props.onBlur({}); assert.equal(flatten(app.render().props.style).borderColor, style.borderColor);
});
test('native ref, keyboard, editing and focus callbacks are forwarded unchanged', () => {
  const events = [], change = () => {}, event = { nativeEvent: { target: 42 } };
  const app = fixture({ onFocus: e => events.push(e), onBlur: e => events.push(e), onChangeText: change,
    keyboardType: 'decimal-pad', secureTextEntry: true, autoFocus: true, value: 'fixture' });
  const input = app.render(); assert.equal(input.type, 'NativeInput'); assert.equal(input.props.ref, app.ref);
  assert.equal(input.props.onChangeText, change); assert.equal(input.props.keyboardType, 'decimal-pad');
  assert.equal(input.props.secureTextEntry, true); assert.equal(input.props.autoFocus, true);
  input.props.onFocus(event); input.props.onBlur(event); assert.deepEqual(events, [event, event]);
});
test('disabled fields and existing error borders take precedence over focus', () => {
  for (const props of [{ editable: false, style: theme.SurfaceStyles.controlDisabled },
    { style: [theme.SurfaceStyles.control, theme.SurfaceStyles.controlError] }]) {
    const app = fixture(props); app.render().props.onFocus({});
    assert.equal(flatten(app.render().props.style).borderColor, flatten(props.style).borderColor);
  }
});
test('borderless monetary fields use their explicit focus variant without gaining borders', () => {
  const app = fixture({ style: { fontSize: 32, textAlign: 'center' }, focusStyle: { color: theme.Colors.accentText } });
  app.render().props.onFocus({}); const s = flatten(app.render().props.style);
  assert.equal(s.color, theme.Colors.accentText); assert.equal(s.borderWidth, undefined); assert.equal(s.fontSize, 32);
});
test('module typography shares the existing regular token without imposing sizes or colors', () => {
  const styles = load('src/components/module-text-styles.ts', name => name === 'react-native' ? native : theme).ModuleTextStyles;
  for (const s of [styles.search, styles.metadata]) { assert.equal(s.fontFamily, theme.Typography.regular);
    assert.equal(s.fontSize, undefined); assert.equal(s.color, undefined); }
  for (const name of ['estoque', 'catalogo', 'fornecedores', 'equipe', 'vendas', 'contratos', 'clientes', 'orcamentos', 'entregas']) {
    const s = fs.readFileSync(`app/plugins/${name}.tsx`, 'utf8');
    assert.match(s, /searchInput:\s*\{\s*\.\.\.ModuleTextStyles.search/);
    assert.match(s, /\.\.\.ModuleTextStyles.metadata/);
  }
});
test('AI header uses the Resources variant and retains its existing back cleanup', () => {
  const s = fs.readFileSync('app/ai-settings.tsx', 'utf8');
  assert.match(s, /<AccountHeader refined title="Inteligência Artificial"/);
  assert.match(s, /onBack=\{\(\) => \{ activeRef.current = false; setDraft\(''\); router.back\(\); \}\}/);
  assert.match(fs.readFileSync('app/resources.tsx', 'utf8'), /<AccountHeader refined/);
});
test('form integrations retain native focus tracking and masked-key rendering', () => {
  const s = fs.readFileSync('app/plugins/vendas.tsx', 'utf8');
  assert.equal((s.match(/onFocus=\{\(\) => setFocusedItemId\(item.id\)\}/g) || []).length, 2);
  for (const file of ['src/components/Tasks/TaskForm.tsx', 'src/components/Calendar/EventForm.tsx',
    'src/components/Calendar/AppointmentForm.tsx', 'src/components/Finance/QuickAddForm.tsx',
    'src/components/information-editor.tsx', 'src/components/api-key-input.tsx']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /<FormTextInput/); assert.doesNotMatch(source, /<TextInput\b/);
  }
  const key = fs.readFileSync('src/components/api-key-input.tsx', 'utf8');
  assert.match(key, /android && \{ color: 'transparent' \}/);
  assert.match(key, /secureTextEntry=\{!android\}/);
});
