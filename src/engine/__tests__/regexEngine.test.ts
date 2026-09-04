import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBotResponse, parseMessage } from '../regexEngine.ts';

test('chit-chat reconhece saudação e orienta para registro', () => {
  const parsed = parseMessage('oi, tudo bem?');

  assert.equal(parsed.intent, 'CHAT_PROMPT');
  assert.equal(buildBotResponse(parsed), 'Tudo bem por aqui! E com você? Se quiser, posso anotar alguma coisa.');
  assert.equal(parseMessage('tudo bem com vc?').intent, 'CHAT_PROMPT');
  assert.equal(parseMessage('tudo bem com voce?').intent, 'CHAT_PROMPT');
  assert.equal(parseMessage('tudo bem com cê?').intent, 'CHAT_PROMPT');
});

test('chit-chat reconhece despedida sem capturar mensagem de lançamento', () => {
  assert.equal(parseMessage('tchau').intent, 'CHAT_PROMPT');
  assert.equal(parseMessage('recebi 40 reais').intent, 'INCOME_RECORD');
});

test('chit-chat aceita variações comuns', () => {
  for (const message of ['bom dia', 'boa noite, tudo certo', 'obrigado', 'valeu', 'oiiiiiii', 'oie']) {
    assert.equal(parseMessage(message).intent, 'CHAT_PROMPT', message);
  }
  assert.equal(buildBotResponse(parseMessage('bom dia')), 'Bom dia! Que seu dia renda. Quer que eu anote algo?');
  assert.equal(buildBotResponse(parseMessage('obrigado')), 'Por nada! Quer registrar mais alguma coisa?');
});
