import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toPointOfInterest } from './wikipedia.ts';

test('maps a geotagged page with an extract', () => {
  const poi = toPointOfInterest({
    pageid: 42,
    title: 'CN Tower',
    extract: 'The CN Tower is a tower in Toronto.',
    coordinates: [{ lat: 43.6426, lon: -79.3871 }],
  });
  assert.equal(poi?.id, 'wiki-42');
  assert.equal(poi?.name, 'CN Tower');
  assert.equal(poi?.latitude, 43.6426);
  assert.equal(poi?.sources[0], 'https://en.wikipedia.org/?curid=42');
});

test('drops pages without coordinates or text', () => {
  assert.equal(toPointOfInterest({ pageid: 1, title: 'A', extract: 'x' }), null);
  assert.equal(toPointOfInterest({ pageid: 2, title: 'B', coordinates: [{ lat: 0, lon: 0 }] }), null);
});
