const test = require('node:test');
const assert = require('node:assert/strict');

const { fixture } = require('./bottom-sheet-fixture.cjs');

test('first Android Back hides the keyboard without dismissing or confirming; second Back protects the draft', () => {
  const app = fixture(); app.render(); app.render({ draft: { name: 'Rascunho' } }); app.openKeyboard();
  app.modalRef.current.requestClose(); assert.equal(app.keyboard, false); assert.equal(app.closed, 0); assert.equal(app.alerts.length, 0);
  app.modalRef.current.requestClose(); assert.equal(app.closed, 0); assert.equal(app.alerts.length, 1);
});
test('cancel confirmation keeps values and repeated close cannot duplicate the dialog', () => {
  const app = fixture(); app.render(); app.render({ draft: { name: 'Rascunho' } });
  app.ref.current.requestClose(); app.ref.current.requestClose(); assert.equal(app.alerts.length, 1);
  app.alerts[0][2][0].onPress(); assert.equal(app.closed, 0);
  app.ref.current.requestClose(); assert.equal(app.alerts.length, 2);
  app.alerts[1][2][1].onPress(); assert.equal(app.closed, 1);
});
test('completed save bypasses confirmation; unchanged and reverted forms dismiss normally', () => {
  const saved = fixture(); saved.render(); saved.render({ draft: { name: 'Salvo' } }); saved.ref.current.close(); assert.equal(saved.closed, 1); assert.equal(saved.alerts.length, 0);
  const unchanged = fixture(); unchanged.render(); unchanged.ref.current.requestClose(); assert.equal(unchanged.closed, 1);
  const reverted = fixture(); reverted.render(); reverted.render({ draft: { name: 'Texto' } }); reverted.render({ draft: { name: '' } }); reverted.ref.current.requestClose(); assert.equal(reverted.closed, 1); assert.equal(reverted.alerts.length, 0);
});
test('registered inner form changes are protected too, while loading prevents dismissal', () => {
  const app = fixture(); const provider = app.render().find(node => node.type === 'DraftProvider');
  provider.props.value.drafts.set({}, { initial: '', current: 'Texto' }); app.ref.current.requestClose(); assert.equal(app.alerts.length, 1);
  const loading = fixture(); loading.render({ dismissible: false }); loading.ref.current.requestClose(); assert.equal(loading.closed, 0); assert.equal(loading.alerts.length, 0);
});
test('an old discard confirmation cannot close a reopened form', () => {
  const app = fixture(); app.render(); app.render({ draft: { name: 'Antigo' } }); app.ref.current.requestClose();
  app.render({ visible: false }); app.render({ visible: true, draft: { name: 'Novo' } }); app.alerts[0][2][1].onPress(); assert.equal(app.closed, 0);
});
