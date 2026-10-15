const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Run the actual Chat callbacks. Keep the native content boundary separate from
// VirtualizedList's last-cell estimate: treating them alike hid the regression.
module.exports = function chatScrollFixture() {
  const source = fs.readFileSync('app/(tabs)/chat.tsx', 'utf8');
  const ast = ts.createSourceFile('chat.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const screen = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'ChatScreen');
  const frames = new Map(); let frameId = 0;
  const metrics = { viewport: 600, content: 2400, offset: 0, calls: 0 };
  const context = {
    useCallback: fn => fn,
    followContentResize: { current: true }, scrollFrame: { current: null }, dragging: { current: false },
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    flatListRef: { current: {
      scrollToEnd() { assert.fail('VirtualizedList estimates must not determine the bottom'); },
      getNativeScrollRef() { return { scrollToEnd(options) {
        assert.equal(options.animated, false);
        metrics.offset = Math.max(0, metrics.content - metrics.viewport);
        metrics.calls++;
      } }; },
    } },
  };
  const names = ['scrollToBottom', 'preserveCardReading', 'handleContentResize'];
  const declarations = names.map(name => screen.body.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(ast) === name)).getText(ast)).join('\n');
  vm.runInNewContext(ts.transpileModule(declarations + '\nglobalThis.handlers = {scrollToBottom, preserveCardReading, handleContentResize};', {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  function paintFrame() {
    for (const [id, fn] of [...frames]) {
      if (!frames.delete(id)) continue;
      fn();
    }
  }
  return { ...context.handlers, metrics, frames, context, paintFrame,
    evaluate(text, globals = {}) {
      Object.assign(context, globals);
      return vm.runInNewContext(ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    },
    paint() { let count = 0; while (frames.size) { assert.ok(++count < 20, 'scroll must settle without a frame loop'); paintFrame(); } },
  };
};
