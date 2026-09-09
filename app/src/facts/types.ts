/** Fact types the user can steer towards. Order is the order shown in the Tune sheet. */
export const FACT_TAGS = [
  'History',
  'Architecture',
  'Fun fact',
  'Pop culture',
  'Famous people',
  'Hidden gem',
  'Local tips',
] as const;

export type FactTag = (typeof FACT_TAGS)[number];

export interface PointOfInterest {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Distance in metres within which the fact is triggered. */
  radiusMeters: number;
  /** At least one tag; the first is the fact's primary type. */
  tags: FactTag[];
  /** 1-3 sentences, speakable in under 20 seconds. */
  fact: string;
  sources: string[];
}

/**
 * The tag shown for a fact: the first of its tags the user has selected,
 * else its first tag.
 */
export function displayTag(poi: PointOfInterest, selected: readonly FactTag[]): FactTag {
  return poi.tags.find((t) => selected.includes(t)) ?? poi.tags[0] ?? 'History';
}
