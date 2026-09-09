import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickTtsModel } from './geminiTts.ts';

test('prefers the newest speech model and strips the models/ prefix', () => {
  const picked = pickTtsModel([
    'models/gemini-3.6-flash',
    'models/gemini-2.5-flash-preview-tts',
    'models/gemini-2.5-pro-preview-tts',
    'models/gemini-3.1-flash-tts-preview',
  ]);
  assert.equal(picked, 'gemini-3.1-flash-tts-preview');
});

test('prefers flash over pro at the same version', () => {
  const picked = pickTtsModel(['models/gemini-2.5-pro-preview-tts', 'models/gemini-2.5-flash-preview-tts']);
  assert.equal(picked, 'gemini-2.5-flash-preview-tts');
});

test('falls back to any speech model, and null when none', () => {
  assert.equal(pickTtsModel(['models/gemini-3-pro-tts']), 'gemini-3-pro-tts');
  assert.equal(pickTtsModel(['models/gemini-3.6-flash']), null);
});
