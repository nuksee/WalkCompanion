# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

WalkCompanion is early-stage. Read `intent.md` first: it is the source of truth for scope, priorities, and non-goals. Update it when a product decision changes rather than letting code and intent drift apart.

Always keep the implementation simple and avoid over-engineering. Prefer the smallest working solution that satisfies the current requirement, and only add complexity when there is clear evidence it is necessary.

If a code change meaningfully affects behavior, constraints, setup, or how contributors work, update the relevant docs at the same time.

As of September 2026 the Expo app in `app/` covers roadmap steps 1 and 2: location, speech, proximity triggers, and live Wikipedia facts. Keep things simple; do not add a backend or new dependencies until a step actually needs them.

## What we are building

A hands-free walking tour guide for iOS and Android. The app tracks location while the user walks a city and narrates short, source-grounded facts about nearby places via text-to-speech, with local notifications as a secondary channel. Toronto is the first test city. Personal project now, possible public tourist app later.

## Planned architecture

Two deliverables, expected to live in this repo:

- **Mobile app** — React Native with Expo (TypeScript). Owns location tracking (foreground and background), proximity triggers, text-to-speech playback, local notifications, an on-screen map/list of recent facts, and local storage for cached "city packs" used offline.
- **Aggregation service** — thin backend that, given a coordinate, fetches nearby places from Wikipedia/Wikidata, OpenStreetMap, Google Maps Places, and Reddit, then asks an LLM (Claude) to write a spoken-length fact. Keeps third-party API keys off the device and caches generated facts per place so they are reused across walks and users.

Timing is hybrid: live generation when online, pre-downloaded city packs as the offline fallback.

## Product rules that constrain code

- Every fact must be grounded in at least one retrieved source; the LLM must not invent details, and generated facts should record which sources they drew on.
- Facts are 1 to 3 sentences, speakable in under 20 seconds.
- Do not repeat a fact about the same place within a single walk.
- Rank candidate facts by proximity, source richness, and novelty. Priority order for content: history and architecture, then local tips and culture, then quirky trivia. Practical info (opening hours, ratings as content) is out of scope for v1.
- Location is sent to the aggregation service only as the coordinates needed to fetch nearby places; no server-side location history in the personal version.
- In the personal version the user supplies their own LLM API key; it stays in the device secure store and is only sent to the LLM provider. Never log it or write it anywhere else.

## Mobile app layout (`app/`)

- `App.tsx` renders `src/screens/WalkScreen.tsx`, the single screen: start/stop walk, current position, list of facts heard.
- `src/location/useWalkLocation.ts` requests foreground permission and streams positions tuned for walking pace. Background tracking is not implemented yet even though `app.json` already declares the permissions and background modes.
- `src/facts/proximity.ts` holds the pure trigger logic (haversine distance, nearest untriggered POI within radius). Keep it free of React and Expo imports so it stays unit-testable under Node.
- `src/facts/wikipedia.ts` queries Wikipedia's keyless geosearch API directly from the app and maps articles to `PointOfInterest` (`src/facts/types.ts`). `WalkScreen` refetches after moving ~300 m and merges results with `src/facts/torontoSeed.ts`, a few hand-written facts kept for testing. There is no backend yet; one is only needed once keyed sources (Google Maps, Reddit) or LLM generation arrive.
- `src/speech/narrator.ts` wraps `expo-speech`; it resolves when speech finishes so the screen can serialise narration.
- `src/llm/` is bring-your-own-key LLM rewriting. `settings.ts` stores the user's key in `expo-secure-store`. `rewriteFact.ts` fixes the provider (Gemini via its OpenAI-compatible endpoint; switching providers means changing `LLM_BASE_URL`/`LLM_MODEL`), turns a raw extract into 1-3 spoken sentences just before narration, and falls back to the raw text on any error. Keep it free of Expo imports so it stays testable under Node. With no key saved, raw Wikipedia text is narrated. `src/screens/SettingsPanel.tsx` is the key entry UI.
- `app/AGENTS.md` (from the Expo template) points at the versioned Expo SDK 57 docs; check them before using an Expo API.

## Commands

Run from `app/`.

```bash
npm start              # Expo dev server; scan the QR code with Expo Go
npx expo start --tunnel   # use on corporate/Public Wi-Fi where the phone cannot reach port 8081 (needs @expo/ngrok dev dep, installed)
npm run android        # start and open on a connected Android device/emulator
npm run ios            # macOS only
npm run typecheck      # tsc --noEmit
npm test               # node --test over src/**/*.test.ts (uses --experimental-strip-types)
node --experimental-strip-types --test src/facts/proximity.test.ts   # single test file
```

Tests use Node's built-in runner, so test files import with explicit `.ts` extensions and must not import React Native or Expo modules. They are excluded from `tsc` in `tsconfig.json`. There is no linter configured.

## Open questions to resolve before building the relevant piece

- Trigger distance and behaviour in dense areas with many points of interest.
- Google Maps pricing and terms for a future public release.
- Reddit API access terms and rate limits.
- Second-language support (Montreal) is deferred.
