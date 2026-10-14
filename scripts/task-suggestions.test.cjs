const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { evaluate } = require('./visual-style-evaluator.cjs');

function fixture(file, imports) {
  const slots = [], effects = []; let cursor = 0;
  const React = {
    useState(initial) { const i = cursor++; slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
    useMemo(fn) { cursor++; return fn(); },
    useCallback(fn) { cursor++; return fn; },
    useEffect(fn, deps) { const i = cursor++; const previous = slots[i]; if (!previous || deps.some((value, j) => value !== previous.deps[j])) { effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); } },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, require(name) {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    return imports(name);
  } });
  return { render(name, arg) { cursor = 0; const result = module.exports[name](arg); while (effects.length) effects.shift()(); return result; } };
}
const nodes = node => !node ? [] : Array.isArray(node) ? node.flatMap(nodes) : typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];
const ui = () => fixture('app/components/Tasks/ModuleSuggestions.tsx', name => {
  if (name === 'react-native') return { View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', StyleSheet: { create: value => value } };
  if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
  if (name.endsWith('/theme')) return evaluate('src/constants/theme.ts').exports;
  throw Error(name);
});

test('no empty section or inert controls when suggestions are absent', () => {
  assert.equal(ui().render('ModuleSuggestions', { suggestions: [], onDismiss() {} }), null);
});

test('preview, view more, dynamic content, creation and individual dismissal use their real callbacks', () => {
  const app = ui(), created = [], dismissed = [];
  const suggestions = ['Produto A', 'Pedido B', 'Fornecedor C'].map((title, i) => ({ id: `id-${i}`, title, label: `Alerta ${i}`, description: `Dados ${i}`, icon: 'cube-outline', tone: 'danger', onCreate: () => created.push(i) }));
  const props = { suggestions, onDismiss: id => dismissed.push(id) };
  let tree = app.render('ModuleSuggestions', props);
  assert.equal(nodes(tree).filter(n => n.props?.accessibilityLabel?.startsWith('Criar tarefa:')).length, 1);
  nodes(tree).find(n => n.props?.accessibilityState?.expanded === false).props.onPress();
  tree = app.render('ModuleSuggestions', props);
  assert.equal(nodes(tree).filter(n => n.props?.accessibilityLabel?.startsWith('Criar tarefa:')).length, 3);
  nodes(tree).find(n => n.props?.accessibilityLabel === 'Criar tarefa: Pedido B').props.onPress();
  nodes(tree).find(n => n.props?.accessibilityLabel === 'Dispensar sugestão: Fornecedor C').props.onPress();
  assert.deepEqual(created, [1]); assert.deepEqual(dismissed, ['id-2']);
  nodes(tree).find(n => n.props?.accessibilityState?.expanded === true).props.onPress();
  tree = app.render('ModuleSuggestions', props);
  assert.equal(nodes(tree).filter(n => n.props?.accessibilityLabel?.startsWith('Criar tarefa:')).length, 1);
  assert.ok(nodes(tree).filter(n => n.type === 'Text').every(n => n.props.numberOfLines === undefined));
});

test('single suggestion does not display a view-more button with nothing else to show', () => {
  const tree = ui().render('ModuleSuggestions', { suggestions: [{ id: 'one', title: 'Título extenso '.repeat(20), label: 'Estoque baixo', description: 'Detalhes extensos '.repeat(20), icon: 'cube-outline', tone: 'danger', onCreate() {} }], onDismiss() {} });
  assert.equal(nodes(tree).some(n => n.props?.accessibilityState), false);
  const card = nodes(tree).find(n => n.props?.style?.backgroundColor === '#FFFFFF');
  assert.equal(card.props.style.borderWidth, 0);
});

const flush = () => new Promise(resolve => setImmediate(resolve));
function suggestionFixture(storage, remote = new Map()) {
  let account;
  const state = { dismissedTaskSuggestionIds: [], stockItems: [{ id: 'untouched' }] };
  const useAppStore = Object.assign(selector => selector(state), {
    getState: () => state, setState: patch => Object.assign(state, patch),
  });
  state.dismissTaskSuggestion = id => { state.dismissedTaskSuggestionIds = [...new Set([...state.dismissedTaskSuggestionIds, id])]; };
  const service = { isStarted: id => !!account && (!id || id === account), async commit() { remote.set(account, [...state.dismissedTaskSuggestionIds]); } };
  const app = fixture('src/hooks/use-dismissed-task-suggestions.ts', name => {
    if (name.includes('async-storage')) return storage;
    if (name === '../store') return { useAppStore };
    if (name.endsWith('businessStateService')) return { businessStateService: service, businessSyncStatus: { reportWarning() {} } };
    if (name.endsWith('confirmedAction')) return { confirmAction: async (_key, prepare) => { const finish = prepare(); await service.commit(); finish?.(); } };
    throw Error(name);
  });
  return { state, remote, render(id) { if (account !== id) { account = id; state.dismissedTaskSuggestionIds = [...(remote.get(id) ?? [])]; } return app.render('useDismissedTaskSuggestions', id); } };
}
test('dismissals persist canonically per account and load on another device without changing module records', async () => {
  const storage = { getItem: async () => null, removeItem: async () => {} };
  const app = suggestionFixture(storage);
  assert.equal(app.render(undefined).ready, false);
  let result = app.render('account-a'); result.dismiss('stock:item:0:5'); await flush();
  assert.equal(app.render('account-a').dismissedIds.has('stock:item:0:5'), true);
  assert.equal(app.render('account-b').dismissedIds.size, 0);
  const secondDevice = suggestionFixture(storage, app.remote);
  result = secondDevice.render('account-a');
  assert.equal(result.dismissedIds.has('stock:item:0:5'), true);
  assert.equal(result.dismissedIds.has('stock:item:4:5'), false);
  assert.deepEqual(app.state.stockItems, [{ id: 'untouched' }]);
});
test('late legacy storage responses cannot migrate one account preference into another', async () => {
  const pending = {}, removed = [];
  const app = suggestionFixture({ getItem: key => new Promise(resolve => { pending[key] = resolve; }), removeItem: async key => removed.push(key) });
  app.render('old'); app.render('current');
  pending['@lumio/task-suggestions/dismissed/current']('[]'); await flush();
  pending['@lumio/task-suggestions/dismissed/old']('["wrong-account"]'); await flush();
  const result = app.render('current');
  assert.equal(result.ready, true); assert.equal(result.dismissedIds.size, 0);
  assert.equal(removed.includes('@lumio/task-suggestions/dismissed/old'), false);
});

test('shortcut corrects virtualized row estimates and supports empty/filter-result lists and reduced motion', () => {
  const source = fs.readFileSync('app/(tabs)/tarefas.tsx', 'utf8');
  const ast = ts.createSourceFile('tarefas.tsx', source, ts.ScriptTarget.Latest, true);
  const names = ['scrollToSuggestionAnchor', 'handleSuggestionsShortcut', 'handleContentSizeChange', 'handleAnchorScrollEnd', 'queueAnchorCheck']; const declarations = [];
  function walk(node) { if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) declarations.push(`const ${node.getText(ast)};`); ts.forEachChild(node, walk); } walk(ast);
  assert.equal(declarations.length, 5);
  const calls = [], timers = [];
  const context = { contentHeight: { current: 10000 }, suggestionsHeight: { current: 300 }, scrollOffset: { current: 0 }, anchorTimer: { current: null }, anchorRequested: { current: false }, filteredTasks: { length: 250 }, reducedMotion: false, Keyboard: { dismiss() {} }, closeOpenSwipeable() {}, setTimeout: fn => { timers.push(fn); return timers.length; } };
  const scrollTo = value => { calls.push(value); context.scrollOffset.current = value.offset ?? value.y ?? 0; };
  const viewport = () => ({ measureInWindow: fn => fn(0, 100, 360, 600) });
  context.taskListRef = { current: { scrollToOffset: scrollTo, scrollToIndex: value => calls.push({ index: value.index, viewPosition: value.viewPosition, animated: value.animated }), getNativeScrollRef: viewport } };
  context.emptyListRef = { current: { scrollTo, scrollToEnd: value => calls.push({ end: true, animated: value.animated }), getNativeScrollRef: viewport } };
  context.suggestionsAnchorRef = { current: { measureInWindow: fn => fn(0, context.contentHeight.current - 300 - 120 - context.scrollOffset.current + 100, 350, 300) } };
  vm.runInNewContext(ts.transpileModule(declarations.join('\n') + '\nglobalThis.subject = { handleSuggestionsShortcut, handleContentSizeChange, handleAnchorScrollEnd };', { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
  context.subject.handleSuggestionsShortcut(); assert.deepEqual(calls.at(-1), { index: 249, viewPosition: 0, animated: true });
  context.subject.handleContentSizeChange(360, 18000);
  assert.equal(timers.length, 1, 'layout changes should not repeatedly restart the scroll animation');
  timers.shift()(); assert.equal(calls.at(-1).offset, 17580);
  timers.shift()(); assert.equal(context.anchorRequested.current, false);
  context.filteredTasks.length = 0; context.reducedMotion = true; context.subject.handleSuggestionsShortcut();
  assert.deepEqual(calls.at(-1), { end: true, animated: false });
  timers.shift()(); assert.equal(context.anchorRequested.current, false);
  context.anchorRequested.current = false; const count = calls.length; context.subject.handleContentSizeChange(360, 19000); assert.equal(calls.length, count);
});
