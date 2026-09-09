import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoRoute, positionAlongRoute } from './demoRoute.ts';
import { distanceMeters } from './proximity.ts';

const origin = { latitude: 43.6426, longitude: -79.3871 };

test('the loop closes and stays near the requested radius', () => {
  const route = buildDemoRoute(origin, 400);
  assert.deepEqual(route[0], route[route.length - 1]);
  for (const point of route) {
    const d = distanceMeters(origin.latitude, origin.longitude, point.latitude, point.longitude);
    assert.ok(Math.abs(d - 400) < 5, `radius was ${d}`);
  }
});

test('walking advances roughly the requested distance', () => {
  const route = buildDemoRoute(origin, 400);
  const start = positionAlongRoute(route, 0);
  const later = positionAlongRoute(route, 100);
  const moved = distanceMeters(start.latitude, start.longitude, later.latitude, later.longitude);
  // Straight-line distance is a chord of the loop, so slightly under the arc walked.
  assert.ok(moved > 90 && moved <= 100, `moved ${moved}`);
});

test('the walk wraps around instead of running off the end', () => {
  const route = buildDemoRoute(origin, 400);
  const perimeter = route
    .slice(1)
    .reduce(
      (sum, p, i) =>
        sum + distanceMeters(route[i]!.latitude, route[i]!.longitude, p.latitude, p.longitude),
      0,
    );
  const start = positionAlongRoute(route, 0);
  const wrapped = positionAlongRoute(route, perimeter * 3);
  assert.ok(
    distanceMeters(start.latitude, start.longitude, wrapped.latitude, wrapped.longitude) < 20,
  );
});
