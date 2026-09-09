import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summariseFeedback } from './preferences.ts';

test('summarises reactions by tag', () => {
  const s = summariseFeedback([
    { tag: 'History', reaction: 'like' },
    { tag: 'History', reaction: 'like' },
    { tag: 'Pop culture', reaction: 'dislike' },
  ]);
  assert.equal(s, 'Liked: History x2. Disliked: Pop culture x1.');
});

test('returns null with no reactions', () => {
  assert.equal(summariseFeedback([]), null);
});
