const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const { evaluate } = require('./visual-style-evaluator.cjs');
const theme = evaluate('src/constants/theme.ts').exports;
const flatten = value => Array.isArray(value) ? Object.assign({}, ...value.map(flatten)) : value || {};
const nodes = node => !node ? [] : Array.isArray(node) ? node.flatMap(nodes) : typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];
function fixture(file, exportName, initialProps) {
  const slots = []; let cursor = 0;
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module, exports: module.exports, require(name) {
    if (name === 'react') return { useRef: value => slots[cursor++] ??= { current: value },
      useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; } };
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === 'react-native') return { View: 'View', Text: 'Text', ScrollView: 'ScrollView', TouchableOpacity: 'TouchableOpacity', StyleSheet: { create: value => value } };
    if (name.endsWith('/theme')) return theme;
    if (name.endsWith('/FAB')) return { FAB_LAYOUT: { size: 56, clearance: 92 } };
    if (name.endsWith('/empty-state')) return { FeedbackEmptyState: 'FeedbackEmptyState' };
    return { Ionicons: 'Ionicons' };
  } });
  let props = initialProps;
  return { exports: module.exports, render(changes = {}) { props = { ...props, ...changes }; cursor = 0; return module.exports[exportName](props); } };
}
test('empty variants share icon proportions and typography without adding card surfaces', () => {
  const app = fixture('src/components/empty-state.tsx', 'FeedbackEmptyState', { icon: 'search-outline', title: 'Nenhum resultado' });
  for (const [variant, circle, icon] of [['compact', 56, 28], ['spacious', 64, 32]]) {
    const tree = app.render({ variant }); const all = nodes(tree);
    assert.equal(flatten(all.find(node => node.props?.importantForAccessibility).props.style).width, circle);
    assert.equal(all.find(node => node.type === 'Ionicons').props.size, icon);
    assert.equal(circle / icon, 2); assert.equal(flatten(tree.props.style).backgroundColor, undefined);
    const text = all.find(node => node.type === 'Text'); assert.equal(flatten(text.props.style).fontFamily, theme.Typography.semibold);
    assert.equal(flatten(text.props.style).color, theme.Colors.primary);
  }
});
test('empty state keeps full text, omits absent descriptions and preserves consumer actions', () => {
  const action = { type: 'Action', props: { onPress() {} } };
  const app = fixture('src/components/empty-state.tsx', 'FeedbackEmptyState', { icon: 'calendar-outline', title: 'Título '.repeat(50), children: action });
  let all = nodes(app.render()); assert.equal(all.filter(node => node.type === 'Text').length, 1);
  all = nodes(app.render({ description: 'Descrição '.repeat(100) }));
  for (const text of all.filter(node => node.type === 'Text')) assert.equal(text.props.numberOfLines, undefined);
  assert.equal(all.find(node => node.type === 'Action'), action);
});
test('calendar empty state stays centered and keeps filtered/unfiltered messages', () => {
  const app = fixture('src/components/Calendar/EmptyState.tsx', 'EmptyState', {});
  let tree = app.render(); assert.equal(tree.props.title, 'Seu dia está livre!'); assert.ok(tree.props.description);
  assert.equal(tree.props.style, undefined, 'asymmetric FAB clearance was shifting the centered copy');
  tree = app.render({ filter: 'task' }); assert.equal(tree.props.title, 'Nenhuma tarefa neste dia.'); assert.equal(tree.props.description, undefined);
  tree = app.render({ filter: 'event' }); assert.equal(tree.props.title, 'Nenhum evento neste dia.');
  const source = fs.readFileSync('app/(tabs)/calendario.tsx', 'utf8');
  assert.match(source, /contentContainerStyle=\{\{ paddingBottom: FAB_LAYOUT.clearance \}\}/);
  assert.match(source, /<CollapsibleCalendar/); assert.match(source, /<FAB onPress=\{\(\) => setSheetVisible\(true\)\}/);
});
test('financial empties retain the clear callback and distinguish no data from filtered results', () => {
  let cleared = 0;
  const app = fixture('src/components/Finance/FinanceEmptyState.tsx', 'FinanceEmptyState', { hasFilters: false, onClearFilters: () => cleared++ });
  assert.equal(app.render().props.title, 'Nenhuma transação');
  assert.equal(app.render({ emptyMonth: true }).props.title, 'Nenhuma transação neste mês');
  let tree = app.render({ hasFilters: true, emptyMonth: false }); assert.equal(tree.props.title, 'Nenhum resultado encontrado');
  nodes(tree).find(node => node.type === 'TouchableOpacity').props.onPress(); assert.equal(cleared, 1);
  tree = app.render({ emptyMonth: true }); assert.equal(nodes(tree).some(node => node.type === 'TouchableOpacity'), false);
});
test('horizontal continuation appears only for overflow and reflects beginning/middle/end', () => {
  const app = fixture('src/components/horizontal-options.tsx', 'HorizontalOptions', {});
  const continuation = app.exports.getHorizontalContinuation;
  assert.equal(continuation(0, 400, 0), ''); assert.equal(continuation(320, 320.5, 0), '');
  assert.equal(continuation(320, 600, 0), 'Deslize para ver mais opções');
  assert.equal(continuation(320, 600, 80), 'Deslize para ver outras opções');
  assert.equal(continuation(320, 600, 280), 'Deslize para voltar às opções');
});
test('measured strips handle scroll/resize/content changes and forward existing events and keyboard props', () => {
  const calls = [], child = { type: 'Option', props: {} };
  const app = fixture('src/components/horizontal-options.tsx', 'HorizontalOptions', { keyboardShouldPersistTaps: 'handled', children: child,
    onLayout: e => calls.push(e), onContentSizeChange: (w, h) => calls.push([w, h]), onScroll: e => calls.push(e) });
  const scroll = () => nodes(app.render()).find(node => node.type === 'ScrollView');
  const layout = { nativeEvent: { layout: { width: 320 } } }, event = { nativeEvent: { contentOffset: { x: 280 } } };
  scroll().props.onLayout(layout); scroll().props.onContentSizeChange(600, 48);
  assert.equal(nodes(app.render()).find(node => node.type === 'Text').props.children, 'Deslize para ver mais opções');
  scroll().props.onScroll(event); assert.equal(nodes(app.render()).find(node => node.type === 'Text').props.children, 'Deslize para voltar às opções');
  scroll().props.onLayout({ nativeEvent: { layout: { width: 700 } } });
  assert.equal(nodes(app.render()).some(node => node.type === 'Text'), false);
  assert.equal(scroll().props.keyboardShouldPersistTaps, 'handled'); assert.equal(scroll().props.children, child);
  assert.equal(scroll().props.horizontal, true); assert.equal(scroll().props.showsHorizontalScrollIndicator, false);
  assert.equal(calls[0], layout); assert.deepEqual(calls[1], [600, 48]); assert.equal(calls[2], event);
});
test('all module empty lists/headers use the shared family; account headers are not introduced', () => {
  for (const name of ['catalogo', 'clientes', 'comissoes', 'contratos', 'entregas', 'equipe', 'estoque', 'fornecedores', 'orcamentos', 'vendas', '[id]']) {
    const source = fs.readFileSync(`app/plugins/${name}.tsx`, 'utf8');
    assert.match(source, /<FeedbackEmptyState variant="compact"/); assert.match(source, /style=\{ModuleTextStyles.headerTitle\}/);
    assert.doesNotMatch(source, /<AccountHeader|<ReportBackdrop/);
  }
  const header = evaluate('src/components/module-text-styles.ts').exports.ModuleTextStyles.headerTitle;
  assert.equal(header.fontFamily, theme.Typography.bold); assert.equal(header.fontSize, theme.FontSize.lg);
  assert.match(fs.readFileSync('app/plugins/[id].tsx', 'utf8'), /Nenhum \$\{def.itemLabel\} ainda\./);
});
test('option strips cover tags, date shortcuts, categories and appointment links without replacing the calendar grid', () => {
  for (const file of ['app/(tabs)/tarefas.tsx', 'src/components/TagSelector.tsx', 'src/components/Tasks/TaskDateSelector.tsx', 'src/components/Finance/QuickAddForm.tsx', 'src/components/Calendar/AppointmentForm.tsx']) {
    assert.match(fs.readFileSync(file, 'utf8'), /<HorizontalOptions/);
  }
  assert.match(fs.readFileSync('src/components/Tasks/TaskDateSelector.tsx', 'utf8'), /<ScrollView horizontal style=\{\{ flexGrow: 0 \}\}/);
});
