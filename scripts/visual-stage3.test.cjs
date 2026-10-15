const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const transpile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const nativeBase = { Platform: { OS: 'android' }, StyleSheet: { create: s => s } };
function load(file, require) { const module = { exports: {} }; vm.runInNewContext(transpile(file), { module, exports: module.exports, require }); return module.exports; }
const theme = load('src/constants/theme.ts', () => nativeBase);
const typography = load('src/utils/calendarTypography.ts', () => theme).getCalendarTypography;
function nodes(node) { return !node ? [] : Array.isArray(node) ? node.flatMap(nodes) : typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []; }
function fixture(file, props) {
  let cursor = 0;
  const slots = [], effects = [];
  const dimensions = { width: 390, height: 844, fontScale: 1 };
  const hooks = { useRef: v => slots[cursor++] ??= { current: v }, useState(v) { const i = cursor++; if (!slots[i])
      slots[i] = { value: typeof v === 'function' ? v() : v }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }]; }, useMemo(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((v, j) => v !== slots[i].deps[j]))
      slots[i] = { value: fn(), deps }; return slots[i].value; }, useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); }, useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((v, j) => v !== slots[i][j]))
      effects.push(fn); slots[i] = deps; } };
  const exports = load(file, name => { if (name === 'react')
    return hooks; if (name === 'react/jsx-runtime')
    return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }; if (name === 'react-native')
    return { ...nativeBase, View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', ScrollView: 'ScrollView', useWindowDimensions: () => dimensions, Animated: { View: 'AnimatedView' } }; if (name.endsWith('/theme'))
    return theme; return { Ionicons: 'Ionicons', FinanceFilterChips: 'FinanceFilterChips' }; });
  return { dimensions, render(changes = {}) { props = { ...props, ...changes }; cursor = 0; const component = exports.BotMessageCard ?? exports.CollapsingHeader; const tree = component(props); effects.splice(0).forEach(fn => fn()); return { tree, nodes: nodes(tree) }; } };
}
const cardFixture = (card = { kind: 'task', title: 'Título', context: 'Resumo' }) => fixture('src/components/chat/BotMessageCard.tsx', { card });
function field(result, id) { const component = result.nodes.find(n => n.props?.id === id); assert.ok(component, `field ${id} exists`); return nodes(component.type(component.props)); }
function lineMeasurement(result, id, count) { field(result, id).find(n => n.type === 'Text' && n.props.onTextLayout).props.onTextLayout({ nativeEvent: { lines: Array.from({ length: count }, () => ({})) } }); }
const toggle = result => result.nodes.find(n => n.props?.accessibilityRole === 'button');
test('normal and reduced font scales preserve calendar geometry; large fonts reserve larger cells', () => { for (const scale of [.8, 1]) {
  const s = typography(scale);
  assert.equal(s.monthDiameter, 34);
  assert.equal(s.compactDiameter, 30);
  assert.equal(s.gridWidth, 336);
} for (const scale of [1.3, 2, 3]) {
  const s = typography(scale);
  assert.ok(s.monthDiameter >= Math.ceil(13 * scale * 1.5) + 8);
  assert.ok(s.columnWidth >= s.monthDiameter + 8);
  assert.equal(s.gridWidth, s.columnWidth * 7);
} assert.equal(typography(NaN).gridWidth, 336); });
test('text fitting the line limits has no expansion control', () => { const app = cardFixture(); let r = app.render(); lineMeasurement(r, 'title', 3); lineMeasurement(r, 'context', 2); r = app.render(); assert.equal(toggle(r), undefined); });
test('truncated title expands and collapses all text without changing the card type', () => { const app = cardFixture(); let r = app.render(); lineMeasurement(r, 'title', 4); r = app.render(); assert.equal(toggle(r).props.accessibilityState.expanded, false); toggle(r).props.onPress(); r = app.render(); assert.equal(toggle(r).props.accessibilityState.expanded, true); assert.equal(field(r, 'title').find(n => n.type === 'Text').props.numberOfLines, undefined); assert.equal(field(r, 'context').find(n => n.type === 'Text').props.numberOfLines, undefined); assert.ok(r.nodes.some(n => n.props?.children === 'Tarefa')); toggle(r).props.onPress(); r = app.render(); assert.equal(field(r, 'title').find(n => n.type === 'Text').props.numberOfLines, 3); });
test('context, person and tag truncation can reveal complete content too', () => { for (const [id, count] of [['context', 3], ['person', 2], ['tag:0', 2]]) {
  const app = cardFixture({ kind: 'task', title: 'Título', context: 'Descrição', assignee: 'Pessoa', tags: ['Etiqueta'] });
  let r = app.render();
  lineMeasurement(r, id, count);
  r = app.render();
  assert.ok(toggle(r));
  toggle(r).props.onPress();
  r = app.render();
  assert.equal(field(r, id).find(n => n.type === 'Text').props.numberOfLines, undefined);
} });
test('unclamped measurement stays outside accessibility and geometry detects overflow without line events', () => { const app = cardFixture(); let r = app.render(); const f = field(r, 'context'); const hidden = f.find(n => n.props?.importantForAccessibility === 'no-hide-descendants'); assert.equal(hidden.props.pointerEvents, 'none'); assert.equal(hidden.props.accessible, false); f[0].props.onLayout({ nativeEvent: { layout: { height: 36 } } }); hidden.props.onLayout({ nativeEvent: { layout: { height: 54 } } }); r = app.render(); assert.ok(toggle(r)); });
test('equal heights and fractional rounding do not create needless expansion controls', () => { const app = cardFixture(); let r = app.render(); const f = field(r, 'title'); f[0].props.onLayout({ nativeEvent: { layout: { height: 42 } } }); f.find(n => n.props?.importantForAccessibility === 'no-hide-descendants').props.onLayout({ nativeEvent: { layout: { height: 42.2 } } }); assert.equal(toggle(app.render()), undefined); });
test('resize invalidates old measurements and ignores delayed events; changed records start compact', () => { const app = cardFixture(); let r = app.render(); const stale = field(r, 'title').find(n => n.props.onTextLayout).props.onTextLayout; lineMeasurement(r, 'title', 4); r = app.render(); assert.ok(toggle(r)); app.dimensions.width = 800; r = app.render(); stale({ nativeEvent: { lines: Array(4) } }); assert.equal(toggle(app.render()), undefined); lineMeasurement(r, 'title', 4); r = app.render(); toggle(r).props.onPress(); r = app.render({ card: { kind: 'task', title: 'Novo' } }); assert.equal(toggle(r), undefined); assert.equal(field(r, 'title').find(n => n.type === 'Text').props.numberOfLines, 3); });
test('font changes trigger fresh measurements; record badges and financial signs remain unchanged', () => { for (const kind of ['task', 'event', 'deadline', 'finance', 'client', 'supplier', 'employee', 'stock', 'catalog', 'module']) {
  const app = cardFixture({ kind, title: 'Título', direction: 'income', amount: 1234.5, pending: true });
  let r = app.render();
  lineMeasurement(r, 'title', 4);
  r = app.render();
  app.dimensions.fontScale = 2;
  r = app.render();
  assert.equal(toggle(r), undefined);
  lineMeasurement(r, 'title', 4);
  r = app.render();
  assert.ok(toggle(r));
  if (kind === 'finance') {
    assert.ok(r.nodes.some(n => Array.isArray(n.props?.children) && n.props.children.join('').includes('+ R$ 1.234,50')));
    assert.ok(r.nodes.some(n => n.props?.children === 'a receber'));
  }
} });
function financeFixture(viewportHeight) { return fixture('src/components/Finance/CollapsingHeader.tsx', { viewportHeight, summary: { entradas: 0, saidas: 0, saldo: 0, categories: [], maxVal: 1 }, scrollY: { interpolate: v => { assert.ok(v.inputRange[1] > v.inputRange[0]); return 0; }, addListener: () => 1, removeListener: () => { } }, headerMinHeight: 90, fmt: String, filterOptions: [], selectedFilter: 'Todos', search: '', searchVisible: false, onSearchChange() { }, onSearchToggle() { }, onFilterSelect() { } }); }
function measureFinance(app, card, filters, row) { let r = app.render(); const text = r.nodes.find(n => n.props?.children === 'Entradas'); const summary = r.nodes.find(n => n.props?.onLayout && nodes(n).includes(text)); summary.props.onLayout({ nativeEvent: { layout: { height: card } } }); r.nodes.find(n => n.props?.onLayout && nodes(n).some(p => p.type === 'FinanceFilterChips')).props.onLayout({ nativeEvent: { layout: { height: filters } } }); r.nodes.find(n => n.props?.onLayout && nodes(n).some(p => p.props?.children === 'Saldo')).props.onLayout({ nativeEvent: { layout: { height: row } } }); return app.render(); }
test('normal financial summaries keep their natural height and do not add a scroll view', () => { const app = financeFixture(600); const r = measureFinance(app, 200, 54, 20); assert.equal(r.tree.props.style[1].height, 270); assert.ok(!r.nodes.some(n => n.type === 'ScrollView')); });
test('large financial content and filters use measured heights without hiding the collapsed balance', () => { const app = financeFixture(420); const r = measureFinance(app, 500, 80, 48); const scroll = r.nodes.find(n => n.type === 'ScrollView'); assert.ok(scroll); assert.equal(scroll.props.style.maxHeight, 192); assert.equal(r.tree.props.style[1].height, 288); assert.ok(r.tree.props.style[1].height <= 420); });
test('expanding a historical card cancels queued autoscroll; a new message resumes following', () => {
  const source = fs.readFileSync('app/(tabs)/chat.tsx', 'utf8'), ast = ts.createSourceFile('chat.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const queue = [], calls = [];
  const context = { followContentResize: { current: true }, flatListRef: { current: { scrollToEnd: () => calls.push('end') } }, setTimeout: fn => queue.push(fn) };
  function walk(n) { if (ts.isVariableDeclaration(n) && ['scrollToBottom', 'preserveCardReading', 'handleContentResize'].includes(n.name.getText(ast)))
    context[n.name.getText(ast)] = vm.runInNewContext('(' + n.initializer.arguments[0].getText(ast) + ')', context); ts.forEachChild(n, walk); }
  walk(ast);
  context.handleContentResize();
  context.preserveCardReading();
  queue.splice(0).forEach(fn => fn());
  assert.equal(calls.length, 0);
  context.handleContentResize();
  assert.equal(queue.length, 0);
  context.scrollToBottom();
  queue.splice(0).forEach(fn => fn());
  assert.equal(calls.length, 1);
});
