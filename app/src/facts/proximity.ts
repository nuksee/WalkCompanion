import type { FactTag, PointOfInterest } from './types';

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

export interface Candidate {
  poi: PointOfInterest;
  distance: number;
}

/**
 * Returns the best point of interest within its trigger radius that has not
 * already been narrated on this walk, or null. Places carrying one of the
 * user's selected tags win over those that do not; ties go to the nearest.
 */
export function pickNextFact(
  latitude: number,
  longitude: number,
  pois: PointOfInterest[],
  alreadyNarrated: ReadonlySet<string>,
  preferredTags: readonly FactTag[] = [],
): Candidate | null {
  let best: (Candidate & { preferred: boolean }) | null = null;
  for (const poi of pois) {
    if (alreadyNarrated.has(poi.id)) continue;
    const distance = distanceMeters(latitude, longitude, poi.latitude, poi.longitude);
    if (distance > poi.radiusMeters) continue;
    const preferred = poi.tags.some((t) => preferredTags.includes(t));
    if (
      !best ||
      (preferred && !best.preferred) ||
      (preferred === best.preferred && distance < best.distance)
    ) {
      best = { poi, distance, preferred };
    }
  }
  return best && { poi: best.poi, distance: best.distance };
}

/**
 * The nearest un-narrated place that is still outside its trigger radius but
 * within `withinMeters`, for the "Next up" status hint. Null if nothing is close.
 */
export function nextUpcoming(
  latitude: number,
  longitude: number,
  pois: PointOfInterest[],
  alreadyNarrated: ReadonlySet<string>,
  withinMeters = 400,
): Candidate | null {
  let best: Candidate | null = null;
  for (const poi of pois) {
    if (alreadyNarrated.has(poi.id)) continue;
    const distance = distanceMeters(latitude, longitude, poi.latitude, poi.longitude);
    if (distance <= poi.radiusMeters || distance > withinMeters) continue;
    if (!best || distance < best.distance) best = { poi, distance };
  }
  return best;
}
