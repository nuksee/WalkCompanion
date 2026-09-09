import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  base64ByteLength,
  bytesToBase64,
  pcmBase64ToWavBase64,
  sampleRateFromMime,
  wavHeader,
} from './wav.ts';

test('header is 54 bytes with RIFF/WAVE/fmt/JUNK/data markers and correct sizes', () => {
  const h = wavHeader(1000, 24000);
  const s = (a: number, b: number) => String.fromCharCode(...h.slice(a, b));
  const v = new DataView(h.buffer);
  assert.equal(h.length, 54);
  assert.equal(s(0, 4), 'RIFF');
  assert.equal(s(8, 12), 'WAVE');
  assert.equal(s(12, 16), 'fmt ');
  assert.equal(s(36, 40), 'JUNK');
  assert.equal(s(46, 50), 'data');
  assert.equal(v.getUint32(4, true), 54 - 8 + 1000);
  assert.equal(v.getUint32(24, true), 24000);
  assert.equal(v.getUint32(28, true), 48000); // byte rate, mono 16-bit
  assert.equal(v.getUint32(50, true), 1000);
});

test('base64 encoder matches Node for the header', () => {
  const h = wavHeader(1234, 24000);
  assert.equal(bytesToBase64(h), Buffer.from(h).toString('base64'));
  assert.equal(bytesToBase64(h).length, 72);
});

test('wav base64 decodes to header followed by the original pcm', () => {
  const pcm = Buffer.from([1, 2, 3, 4, 5, 6, 7]);
  const wav = Buffer.from(pcmBase64ToWavBase64(pcm.toString('base64'), 24000), 'base64');
  assert.equal(wav.length, 54 + 7);
  assert.deepEqual([...wav.subarray(54)], [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(wav.readUInt32LE(50), 7);
});

test('base64 byte length handles padding', () => {
  assert.equal(base64ByteLength(Buffer.from([1]).toString('base64')), 1);
  assert.equal(base64ByteLength(Buffer.from([1, 2]).toString('base64')), 2);
  assert.equal(base64ByteLength(Buffer.from([1, 2, 3]).toString('base64')), 3);
});

test('sample rate parses from mime, with fallback', () => {
  assert.equal(sampleRateFromMime('audio/L16;codec=pcm;rate=24000'), 24000);
  assert.equal(sampleRateFromMime('audio/L16'), 24000);
  assert.equal(sampleRateFromMime(undefined, 16000), 16000);
});
