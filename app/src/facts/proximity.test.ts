import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distanceMeters, nextUpcoming, pickNextFact } from './proximity.ts';
import { torontoSeed } from './torontoSeed.ts';

test('distance between CN Tower and Old City Hall is roughly 1.2 km', () => {
  const d = distanceMeters(43.6426, -79.3871, 43.6525, -79.3818);
  assert.ok(d > 1100 && d < 1300, `got ${d}`);
});

test('picks the point of interest when inside its radius', () => {
  const hit = pickNextFact(43.6427, -79.3870, torontoSeed, new Set());
  assert.equal(hit?.poi.id, 'cn-tower');
});

test('returns null when nothing is within range', () => {
  const hit = pickNextFact(43.70, -79.40, torontoSeed, new Set());
  assert.equal(hit, null);
});

test('skips facts already narrated on this walk', () => {
  const hit = pickNextFact(43.6427, -79.3870, torontoSeed, new Set(['cn-tower']));
  assert.equal(hit, null);
});

test('prefers a place carrying a selected tag over a nearer one without', () => {
  const near = { ...torontoSeed[0], id: 'near', tags: ['Pop culture' as const] };
  const far = { ...torontoSeed[0], id: 'far', latitude: 43.6431, tags: ['History' as const] };
  const hit = pickNextFact(43.6426, -79.3871, [near, far], new Set(), ['History']);
  assert.equal(hit?.poi.id, 'far');
  const noPref = pickNextFact(43.6426, -79.3871, [near, far], new Set(), []);
  assert.equal(noPref?.poi.id, 'near');
});

test('nextUpcoming reports a place outside its radius but nearby', () => {
  const hit = nextUpcoming(43.6404, -79.3871, torontoSeed, new Set());
  assert.equal(hit?.poi.id, 'cn-tower');
  assert.equal(nextUpcoming(43.6427, -79.387, torontoSeed, new Set()), null);
});
