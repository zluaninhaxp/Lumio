const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function calendar(instant, timezone = 'America/Sao_Paulo') {
  process.env.TZ = timezone;
  let now = Date.parse(instant), cursor = 0, mounted = false, tick, resume;
  const values = [], effects = [];
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial; return [values[i], next => { values[i] = typeof next === 'function' ? next(values[i]) : next; }]; },
    useRef(initial) { const i = cursor++; return values[i] ??= { current: initial }; },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => { if (!mounted) effects.push(fn); },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/hooks/useCalendarState.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Date: Clock, String, Array, setInterval: fn => { tick = fn; }, clearInterval() {}, require: name => name === 'react' ? hooks : name === 'react-native' ? { AppState: { addEventListener: (_name, fn) => { resume = fn; return { remove() {} }; } } } : { localISO: date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` } });
  const render = () => { cursor = 0; const result = module.exports.useCalendarState(); if (!mounted) { mounted = true; effects.forEach(fn => fn()); } return result; };
  return { render, advance(instant, foreground = false) { now = Date.parse(instant); if (foreground) resume('active'); else tick(); return render(); } };
}
test('calendar defaults to the local day even when UTC is already tomorrow', () => {
  const c = calendar('2026-10-16T02:30:00Z'); const state = c.render();
  assert.equal(state.today, '2026-10-15'); assert.equal(state.selectedDate, state.today); assert.equal(state.isSelected(15), true); assert.equal(state.isToday(15), true);
});
test('positive UTC offsets do not shift week days or day navigation backwards', () => {
  const c = calendar('2026-10-15T11:30:00Z', 'Pacific/Kiritimati'); let state = c.render();
  assert.equal(state.today, '2026-10-16'); assert.equal(state.selectedWeekDays.find(day => day.day === 16).dateStr, '2026-10-16');
  state.nextDay(); state = c.render(); assert.equal(state.selectedDate, '2026-10-17');
});
test('month/year navigation and adjacent compact-week selection use the exact date', () => {
  const c = calendar('2026-12-31T15:00:00Z'); let state = c.render();
  state.nextMonth(); state = c.render(); assert.equal(state.visibleYear, 2027); assert.equal(state.visibleMonth, 0);
  state.prevMonth(); state = c.render(); assert.equal(state.visibleYear, 2026); assert.equal(state.visibleMonth, 11);
  state.selectDay(1, '2027-01-01'); state = c.render(); assert.equal(state.selectedDate, '2027-01-01'); assert.equal(state.visibleYear, 2027); assert.equal(state.visibleMonth, 0);
});
test('midnight and foreground update today while preserving a deliberately selected date', () => {
  const c = calendar('2026-12-31T02:59:00Z'); let state = c.render();
  state = c.advance('2026-12-31T03:01:00Z'); assert.equal(state.selectedDate, '2026-12-31'); assert.equal(state.today, '2026-12-31');
  state = c.advance('2027-01-01T03:01:00Z', true); assert.equal(state.selectedDate, '2027-01-01'); assert.equal(state.visibleMonth, 0); assert.equal(state.visibleYear, 2027);
  state.selectDay(10); c.render(); state = c.advance('2027-01-02T03:01:00Z'); assert.equal(state.selectedDate, '2027-01-10'); assert.equal(state.today, '2027-01-02');
});
test('midnight does not cancel month browsing and leap day navigation is correct', () => {
  const c = calendar('2028-02-28T15:00:00Z'); let state = c.render(); state.nextDay(); state=c.render(); assert.equal(state.selectedDate,'2028-02-29'); state.nextDay(); state=c.render(); assert.equal(state.selectedDate,'2028-03-01');
  const browsing=calendar('2026-10-15T15:00:00Z'); state=browsing.render(); state.nextMonth(); browsing.render(); state=browsing.advance('2026-10-16T03:01:00Z'); assert.equal(state.visibleMonth,10); assert.equal(state.selectedDate,'2026-10-16');
});
