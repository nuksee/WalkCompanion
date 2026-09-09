export type FactCategory = 'history' | 'architecture' | 'culture' | 'trivia';

export interface PointOfInterest {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Distance in metres within which the fact is triggered. */
  radiusMeters: number;
  category: FactCategory;
  /** 1-3 sentences, speakable in under 20 seconds. */
  fact: string;
  sources: string[];
}
