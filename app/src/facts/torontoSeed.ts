import type { PointOfInterest } from './types';

/**
 * Hand-written seed facts for testing the trigger loop in downtown Toronto.
 * These will be replaced by the aggregation service in a later step.
 */
export const torontoSeed: PointOfInterest[] = [
  {
    id: 'cn-tower',
    name: 'CN Tower',
    latitude: 43.6426,
    longitude: -79.3871,
    radiusMeters: 150,
    tags: ['Architecture', 'Famous people'],
    fact: 'The CN Tower was the tallest free-standing structure in the world for 32 years after it opened in 1976. It was built by Canadian National Railway mainly as a broadcast antenna.',
    sources: ['https://en.wikipedia.org/wiki/CN_Tower'],
  },
  {
    id: 'flatiron',
    name: 'Gooderham Building',
    latitude: 43.6486,
    longitude: -79.3747,
    radiusMeters: 80,
    tags: ['History', 'Architecture'],
    fact: 'The red-brick Gooderham Building was finished in 1892, a decade before the famous Flatiron in New York. It was the office of the Gooderham and Worts distillery family.',
    sources: ['https://en.wikipedia.org/wiki/Gooderham_Building'],
  },
  {
    id: 'old-city-hall',
    name: 'Old City Hall',
    latitude: 43.6525,
    longitude: -79.3818,
    radiusMeters: 100,
    tags: ['Fun fact', 'Hidden gem'],
    fact: 'Look up at the gargoyles on Old City Hall. Architect E. J. Lennox carved caricatures of the councillors who criticised his budget, and hid his own name in the stonework.',
    sources: ['https://en.wikipedia.org/wiki/Old_City_Hall_(Toronto)'],
  },
  {
    id: 'kensington',
    name: 'Kensington Market',
    latitude: 43.6547,
    longitude: -79.4005,
    radiusMeters: 200,
    tags: ['Local tips', 'Pop culture'],
    fact: 'Kensington Market has been a first stop for newcomers since the early 1900s, from Jewish merchants to Portuguese, Caribbean, and Latin American families. Locals swear by the pedestrian Sundays in summer.',
    sources: ['https://en.wikipedia.org/wiki/Kensington_Market'],
  },
];
