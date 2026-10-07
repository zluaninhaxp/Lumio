const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture() {
  const timers = [];
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync('src/services/appAlert.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, setTimeout: callback => timers.push(callback) });
  return { ...module.exports, flush: () => timers.splice(0).forEach(callback => callback()) };
}

test('back/backdrop cancellation never runs the destructive callback', () => {
  const { AppAlert, alertStore, flush } = fixture();
  let deleted = 0, canceled = 0, dismissed = 0;
  AppAlert.alert('Excluir', 'Mensagem', [
    { text: 'Cancelar', style: 'cancel', onPress: () => canceled++ },
    { text: 'Excluir', style: 'destructive', onPress: () => deleted++ },
  ], { onDismiss: () => dismissed++ });
  const request = alertStore.getSnapshot();
  alertStore.finish(request);
  alertStore.finish(request);
  flush();
  assert.equal(deleted, 0);
  assert.equal(canceled, 1);
  assert.equal(dismissed, 1);
  assert.equal(alertStore.getSnapshot(), null);
});

test('double tap cannot duplicate confirmation; nested failure waits for fade-out', () => {
  const { AppAlert, alertStore, flush } = fixture();
  let confirmed = 0;
  const action = { text: 'Confirmar', onPress: () => { confirmed++; AppAlert.alert('Erro', 'Preservado'); } };
  AppAlert.alert('Confirmar?', 'Mensagem', [action]);
  AppAlert.alert('Confirmar?', 'Mensagem', [action]);
  const request = alertStore.getSnapshot();
  alertStore.finish(request, request.actions[0]);
  alertStore.finish(request, request.actions[0]);
  assert.equal(confirmed, 1);
  assert.equal(alertStore.getSnapshot(), null);
  flush();
  assert.equal(alertStore.getSnapshot().title, 'Erro');
  alertStore.finish(alertStore.getSnapshot());
  flush();
  assert.equal(alertStore.getSnapshot(), null);
});

test('queued decisions preserve their original callbacks and async return', async () => {
  const { AppAlert, alertStore, flush } = fixture();
  let saved = false;
  AppAlert.alert('Primeiro');
  AppAlert.alert('Segundo', '', [{ text: 'Salvar', onPress: async () => { await Promise.resolve(); saved = true; } }]);
  alertStore.finish(alertStore.getSnapshot());
  flush();
  const request = alertStore.getSnapshot();
  assert.equal(request.title, 'Segundo');
  alertStore.finish(request, request.actions[0]);
  await Promise.resolve();
  assert.equal(saved, true);
});

test('all internal calls use shared alerts; success feedback stays non-blocking', () => {
  function files(folder) {
    return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${folder}/${entry.name}`) : [`${folder}/${entry.name}`]);
  }
  for (const file of [...files('app'), ...files('src')].filter(file => /\.tsx?$/.test(file))) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const node of source.statements) {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier.text === 'react-native') {
        const imports = node.importClause?.namedBindings;
        if (imports && ts.isNamedImports(imports)) assert.ok(!imports.elements.some(element => (element.propertyName ?? element.name).text === 'Alert'), file);
      }
    }
    assert.ok(!/window\.(confirm|alert)\s*\(/.test(source.text), file);
  }
  for (const file of ['app/profile.tsx', 'app/settings.tsx', 'app/plugins/orcamentos.tsx']) assert.match(fs.readFileSync(file, 'utf8'), /AppFeedback\.show/);
});

function dialogFixture() {
  const slots = [], effects = [];
  let cursor = 0;
  const hooks = {
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useState(value) { return [value, () => {}]; },
    useEffect(callback, dependencies) {
      const index = cursor++;
      if (!slots[index] || dependencies.some((value, i) => value !== slots[index][i])) effects.push(callback);
      slots[index] = dependencies;
    },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/components/app-dialog.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const native = new Proxy({ StyleSheet: { create: value => value }, useWindowDimensions: () => ({ height: 844 }) }, { get: (target, key) => target[key] ?? key });
  vm.runInNewContext(source, { module, exports: module.exports, require: name => {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === 'react-native') return native;
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) };
    if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
    return { Colors: {}, DialogTokens: {}, SurfaceStyles: { overlay: {} }, Typography: {} };
  } });
  function nodes(node) { return !node ? [] : Array.isArray(node) ? node.flatMap(nodes) : typeof node === 'object' ? [node, ...nodes(node.props.children)] : []; }
  return props => { cursor = 0; const tree = module.exports.AppDialog(props); effects.splice(0).forEach(effect => effect()); return { tree, nodes: nodes(tree) }; };
}

test('loading blocks Android back, backdrop and all actions; failed work can be retried', () => {
  const render = dialogFixture();
  let confirms = 0, cancels = 0;
  const props = { visible: true, title: 'Continuar?', loading: true, onCancel: () => cancels++, actions: [{ text: 'Salvar', onPress: () => confirms++ }, { text: 'Cancelar', style: 'cancel', onPress: () => cancels++ }] };
  let result = render(props);
  result.tree.props.onRequestClose();
  for (const node of result.nodes.filter(node => node.props.onPress)) node.props.onPress();
  assert.equal(confirms, 0);
  assert.equal(cancels, 0);
  assert.ok(result.nodes.filter(node => node.type === 'TouchableOpacity').every(node => node.props.disabled && node.props.accessibilityState.busy));
  result = render({ ...props, loading: false, error: 'Tente novamente' });
  const confirm = result.nodes.find(node => node.props.accessibilityLabel === 'Salvar');
  confirm.props.onPress();
  confirm.props.onPress();
  assert.equal(confirms, 1);
});

test('Android back and backdrop both cancel; destructive confirm remains distinct', () => {
  const render = dialogFixture();
  let cancels = 0, deletes = 0;
  const result = render({ visible: true, title: 'Excluir?', variant: 'destructive', onCancel: () => cancels++, actions: [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => deletes++ }] });
  result.tree.props.onRequestClose();
  result.nodes.find(node => node.type === 'Pressable').props.onPress();
  assert.equal(cancels, 2);
  assert.equal(deletes, 0);
  assert.deepEqual(result.nodes.filter(node => node.type === 'TouchableOpacity').map(node => node.props.accessibilityLabel), ['Excluir', 'Cancelar']);
});
