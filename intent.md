# WalkCompanion — Intent

## Vision

A mobile app that acts as a personal tour guide. As I walk through a city, it notices where I am and tells me interesting facts about the buildings, streets, and neighbourhoods around me, hands-free.

## Goals

1. Deliver location-relevant facts while walking, with no need to look at the phone.
2. Combine several content sources into short, engaging, trustworthy narration.
3. Work well in Toronto first, with a design that generalises to any city.
4. Start as a personal project; keep a path open to a public app for tourists later.

## Non-goals (for now)

- Turn-by-turn navigation or route planning.
- User accounts, social features, monetisation, analytics.
- Perfect offline coverage for every city.
- Web or desktop versions.

## Target users

- **Now:** me, walking in Toronto.
- **Later:** tourists and curious locals in any mid-to-large city.

## Platform and stack

- **Platforms:** iOS and Android from one codebase.
- **Framework:** React Native with Expo (TypeScript).
- **Key device capabilities:** foreground and background location, text-to-speech, local notifications, local storage for cached city packs.
- **Backend:** none for the personal version. The user pastes their own LLM API key into the app (Gemini for now, via its OpenAI-compatible endpoint), stored in the device secure store. A thin aggregation service that holds keys and caches facts per place is deferred until a public release needs it.

## Fact delivery

- **Audio narration (primary):** text-to-speech reads a fact aloud when I approach a point of interest. Should pause or lower for phone calls and other audio.
- **Push / local notifications (secondary):** short alert with a one-line hook when audio is off or the screen is locked; tapping opens the full fact.
- **On-screen:** simple map or list showing recent and nearby facts, mainly as a fallback and for review afterwards.

## Content sources

| Source | Role |
|---|---|
| Wikipedia / Wikidata | Geo-tagged articles for history, architecture, notable people |
| OpenStreetMap | Place names, building footprints, categories, addresses |
| Google Maps Places | Place identity, popularity, and ratings to help rank what is worth mentioning |
| Reddit | Local voice: tips, hidden gems, neighbourhood lore from city subreddits |
| LLM (Claude) | Synthesises the above into a spoken-length fact; must cite which sources it drew on |

### Fact priorities

1. History and architecture.
2. Local tips and culture.
3. Quirky and fun trivia.

Practical info such as opening hours is out of scope for the first version.

### Quality rules

- Every fact is grounded in at least one retrieved source; the LLM must not invent details.
- Facts are 1 to 3 sentences, spoken in under 20 seconds.
- Do not repeat a fact about the same place within a walk.
- Rank by proximity, source richness, and novelty.

## Timing and connectivity

- **Hybrid model.** When online, fetch nearby places and generate facts live as I walk.
- **City packs.** Allow pre-downloading facts for a chosen area so a walk works with poor or no signal. Use the pack when available and fall back to live generation otherwise.
- Cache every generated fact on the device and server so later walks and later users reuse it.

## Privacy

- Location stays on the device except for the coordinates sent to the aggregation service to fetch nearby places.
- No location history is stored server-side in the personal version.
- Any public release will need a clear privacy policy before launch.

## Success criteria for the first version

- Walk 30 minutes through downtown Toronto and hear at least one relevant, accurate fact every few blocks.
- Narration triggers within a reasonable distance of a landmark without needing to unlock the phone.
- Battery drain over a one-hour walk is acceptable for daily use.
- A pre-downloaded Toronto pack works in airplane mode.

## Open questions

- Trigger distance and how to handle dense areas with many points of interest.
- How much to rely on Google Maps given its pricing and terms for a future public app.
- Reddit API access terms and rate limits.
- Whether to support a second language for Montreal later.

## Rough roadmap

1. ~~Expo app skeleton with location tracking and text-to-speech.~~ Done.
2. ~~Wikipedia facts for a coordinate.~~ Done, called directly from the app; no backend yet. OpenStreetMap deferred until needed.
3. LLM fact generation with source grounding.
4. Proximity triggers and notifications, tested on Toronto walks.
5. Add Reddit and Google Maps as ranking and colour sources.
6. City pack download and offline mode.
7. Evaluate readiness for a public beta.
