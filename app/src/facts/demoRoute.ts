import { distanceMeters } from './proximity.ts';

/**
 * Demo mode: a simulated walk around wherever the user actually is, so the
 * proximity pipeline can be exercised indoors. Pure so it stays unit-testable.
 */

export interface Coord {
  latitude: number;
  longitude: number;
}

/** Radius of the generated loop. Wide enough to pass different Wikipedia places. */
const LOOP_RADIUS_M = 400;
/** Points on the loop; segments are straight lines between them. */
const LOOP_POINTS = 24;
/** Metres per second of a relaxed walk, before the speed multiplier. */
export const WALK_SPEED_MPS = 1.4;

const METRES_PER_DEGREE_LAT = 111_320;

/** A closed loop of coordinates centred on `origin`, walked clockwise from due north. */
export function buildDemoRoute(origin: Coord, radiusMeters = LOOP_RADIUS_M): Coord[] {
  const lonScale = Math.cos((origin.latitude * Math.PI) / 180) || 1;
  const points: Coord[] = [];
  for (let i = 0; i < LOOP_POINTS; i++) {
    const angle = (i / LOOP_POINTS) * 2 * Math.PI;
    const north = Math.cos(angle) * radiusMeters;
    const east = Math.sin(angle) * radiusMeters;
    points.push({
      latitude: origin.latitude + north / METRES_PER_DEGREE_LAT,
      longitude: origin.longitude + east / (METRES_PER_DEGREE_LAT * lonScale),
    });
  }
  // Close the loop so walking past the last point returns to the first.
  points.push({ ...points[0]! });
  return points;
}

/**
 * The point `travelled` metres along `route`, wrapping around when the walk
 * passes the end so a demo can run indefinitely.
 */
export function positionAlongRoute(route: Coord[], travelled: number): Coord {
  if (route.length === 0) throw new Error('empty route');
  if (route.length === 1) return route[0]!;

  const legs = route.slice(1).map((point, i) => distanceMeters(
    route[i]!.latitude,
    route[i]!.longitude,
    point.latitude,
    point.longitude,
  ));
  const total = legs.reduce((sum, leg) => sum + leg, 0);
  if (total === 0) return route[0]!;

  let remaining = ((travelled % total) + total) % total;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!;
    if (remaining <= leg) {
      const t = leg === 0 ? 0 : remaining / leg;
      const from = route[i]!;
      const to = route[i + 1]!;
      return {
        latitude: from.latitude + (to.latitude - from.latitude) * t,
        longitude: from.longitude + (to.longitude - from.longitude) * t,
      };
    }
    remaining -= leg;
  }
  return route[route.length - 1]!;
}
