const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/chat/pending-replies.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: moduleUnderTest, exports: moduleUnderTest.exports });
const { trackPendingReply, unansweredReplies } = moduleUnderTest.exports;
const bot = (id, pending = false) => ({ id, type: 'bot', pending });

test('instant send and response preparation own one request, including duplicate events', () => {
  let replies = trackPendingReply([], 'user-1');
  assert.equal(replies.length, 1);
  assert.equal(trackPendingReply(replies, 'user-1'), replies);
  replies = trackPendingReply(replies, 'user-1', 'bot-1');
  assert.equal(replies.length, 1);
  assert.equal(trackPendingReply(replies, 'user-1', 'bot-1'), replies);
  assert.equal(unansweredReplies(replies, []).length, 1);
});

test('visible corresponding response ends typing even while journal/commit is still busy', () => {
  const replies = trackPendingReply([], 'user-1', 'bot-1');
  assert.equal(unansweredReplies(replies, [bot('bot-1', true)]).length, 1, 'unconfirmed hidden response stays pending');
  assert.equal(unansweredReplies(replies, [bot('other-response')]).length, 1, 'unrelated history cannot complete this request');
  assert.equal(unansweredReplies(replies, [bot('bot-1')]).length, 0, 'visibility wins immediately over persistence timing');
  assert.equal(unansweredReplies(replies, [{ ...bot('bot-1'), type: 'fallback' }]).length, 0, 'fallback responses complete their request too');
});

test('consecutive messages keep only the requests whose own responses are missing', () => {
  let replies = trackPendingReply([], 'user-1', 'bot-1');
  replies = trackPendingReply(replies, 'user-2');
  replies = trackPendingReply(replies, 'user-3', 'bot-3');
  replies = unansweredReplies(replies, [bot('bot-1'), bot('bot-3')]);
  assert.equal(replies.length, 1);
  assert.equal(replies[0].requestId, 'user-2');
  replies = trackPendingReply(replies, 'user-2', 'bot-2');
  assert.equal(unansweredReplies(replies, [bot('bot-2')]).length, 0);
});

test('completed requests cannot be resurrected by sync, rehydration or repeated history events', () => {
  let replies = trackPendingReply([], 'user-1', 'bot-1');
  replies = unansweredReplies(replies, [bot('bot-1')]);
  for (const history of [[], [bot('bot-1', true)], [bot('bot-1')], [bot('other-response')]]) {
    replies = unansweredReplies(replies, history);
    assert.equal(replies.length, 0);
  }
});

test('pruning an acknowledged response preserves a concurrently enqueued message', () => {
  const existing = trackPendingReply([], 'user-1', 'bot-1');
  const withNewSend = trackPendingReply(existing, 'user-2');
  const result = unansweredReplies(withNewSend, [bot('bot-1')]);
  assert.equal(result.length, 1);
  assert.equal(result[0].requestId, 'user-2');
});
