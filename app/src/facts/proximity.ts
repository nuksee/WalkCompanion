import type { PointOfInterest } from './types';

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance between two coordinates in metres. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Returns the nearest point of interest within its trigger radius that has
 * not already been narrated on this walk, or null.
 */
export function pickNextFact(
  latitude: number,
  longitude: number,
  pois: PointOfInterest[],
  alreadyNarrated: ReadonlySet<string>,
): { poi: PointOfInterest; distance: number } | null {
  let best: { poi: PointOfInterest; distance: number } | null = null;
  for (const poi of pois) {
    if (alreadyNarrated.has(poi.id)) continue;
    const distance = distanceMeters(latitude, longitude, poi.latitude, poi.longitude);
    if (distance > poi.radiusMeters) continue;
    if (!best || distance < best.distance) best = { poi, distance };
  }
  return best;
}
