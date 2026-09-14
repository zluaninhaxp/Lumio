import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCommandHelp, missingCommandFields, parseCommand } from '../commandEngine.ts';

test('parseia comando com argumentos nomeados e valores com espaço', () => {
  const parsed = parseCommand('/adicionarcliente nome="Maria da Silva" contato="11 99999-0000"');
  assert.ok(parsed && 'action' in parsed);
  assert.equal(parsed.action, 'add_client');
  assert.equal(parsed.args.nome, 'Maria da Silva');
  assert.equal(parsed.args.contato, '11 99999-0000');
});

test('aceita alias e nome posicional', () => {
  const parsed = parseCommand('/cliente João');
  assert.ok(parsed && 'action' in parsed);
  assert.equal(parsed.action, 'add_client');
  assert.equal(parsed.args.nome, 'João');
});

test('indica campo obrigatório e oferece ajuda', () => {
  const parsed = parseCommand('/fornecedor');
  assert.ok(parsed && 'action' in parsed);
  assert.deepEqual(missingCommandFields(parsed), ['nome']);
  assert.match(buildCommandHelp(), /adicionarcliente/);
});
