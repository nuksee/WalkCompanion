import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildMessages, extractText } from './rewriteFact.ts';

const poi = {
  id: 'x',
  name: 'CN Tower',
  latitude: 0,
  longitude: 0,
  radiusMeters: 100,
  tags: ['History' as const],
  fact: 'The CN Tower is a tower.',
  sources: [],
};

test('user message carries the place name and source text', () => {
  const [system, user] = buildMessages(poi);
  assert.equal(system.role, 'system');
  assert.match(user.content, /CN Tower/);
  assert.match(user.content, /The CN Tower is a tower\./);
});

test('extracts assistant text from a chat completion', () => {
  const json = { choices: [{ message: { content: '  A short fact.  ' } }] };
  assert.equal(extractText(json), 'A short fact.');
});

test('returns null for malformed or empty responses', () => {
  assert.equal(extractText({}), null);
  assert.equal(extractText({ choices: [{ message: { content: '' } }] }), null);
  assert.equal(extractText(null), null);
});

test('steering adds the tag and feedback, with the source text last', () => {
  const [, user] = buildMessages(poi, { tag: 'Hidden gem', feedback: 'Liked: History x1.' });
  assert.match(user.content, /"Hidden gem"/);
  assert.match(user.content, /Liked: History x1\./);
  assert.ok(user.content.indexOf('Source text:') > user.content.indexOf('Liked:'));
});
