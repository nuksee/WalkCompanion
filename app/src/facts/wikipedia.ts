import type { PointOfInterest } from './types';

const API = 'https://en.wikipedia.org/w/api.php';
const TRIGGER_RADIUS_M = 120;

interface WikiPage {
  pageid: number;
  title: string;
  extract?: string;
  coordinates?: { lat: number; lon: number }[];
}

/** Turns a Wikipedia page into a point of interest. Returns null if unusable. */
export function toPointOfInterest(page: WikiPage): PointOfInterest | null {
  const coord = page.coordinates?.[0];
  const text = page.extract?.trim();
  if (!coord || !text) return null;
  return {
    id: `wiki-${page.pageid}`,
    name: page.title,
    latitude: coord.lat,
    longitude: coord.lon,
    radiusMeters: TRIGGER_RADIUS_M,
    category: 'history',
    fact: text,
    sources: [`https://en.wikipedia.org/?curid=${page.pageid}`],
  };
}

/** Fetches Wikipedia articles geotagged within `radiusMeters` of a coordinate. */
export async function fetchNearbyWikipedia(
  latitude: number,
  longitude: number,
  radiusMeters = 500,
): Promise<PointOfInterest[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'geosearch',
    ggscoord: `${latitude}|${longitude}`,
    ggsradius: String(radiusMeters),
    ggslimit: '20',
    prop: 'extracts|coordinates',
    exintro: '1',
    explaintext: '1',
    exsentences: '2',
    exlimit: '20',
  });
  const res = await fetch(`${API}?${params}`);
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const json = (await res.json()) as { query?: { pages?: Record<string, WikiPage> } };
  const pages = Object.values(json.query?.pages ?? {});
  return pages.map(toPointOfInterest).filter((p): p is PointOfInterest => p !== null);
}
