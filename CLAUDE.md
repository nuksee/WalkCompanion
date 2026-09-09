# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

WalkCompanion is early-stage. Read `intent.md` first: it is the source of truth for scope, priorities, and non-goals. Update it when a product decision changes rather than letting code and intent drift apart.

Always keep the implementation simple and avoid over-engineering. Prefer the smallest working solution that satisfies the current requirement, and only add complexity when there is clear evidence it is necessary.

If a code change meaningfully affects behavior, constraints, setup, or how contributors work, update the relevant docs at the same time.

As of September 2026 the Expo app in `app/` covers roadmap steps 1 to 3: location, speech, proximity triggers, live Wikipedia facts, and optional LLM rewriting with the user's own key. Keep things simple; do not add a backend or new dependencies until a step actually needs them.

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
- Personalisation (roadmap step 4, built): users steer content two ways, by selecting fact-type tags (History, Architecture, Fun fact, Pop culture, Famous people, Hidden gem, Local tips) and by liking or disliking a heard fact, done by swiping its card right or left. Every `PointOfInterest` therefore carries `tags: FactTag[]`. The device is the source of truth: selected tags persist in `expo-secure-store` and reactions live in screen state for the walk, and both ride along with the LLM request rather than being stored anywhere else. Whether they are ever stored server-side is an open question tied to accounts.

## Mobile app layout (`app/`)

- `App.tsx` renders `src/screens/WalkScreen.tsx`, the single screen: a status line, the hero fact card, start/stop walk plus Tune, and the list of facts heard earlier. Its **Random fact** button exists for testing at home: it runs one loaded place through the same `speakFact` path as a real proximity trigger (LLM rewrite if a key is set, then speech and a history card), first fetching real Wikipedia places near the current fix or, with no fix, near the CN Tower. Keep triggers and Random fact on that shared path so home tests exercise the real pipeline. **Demo mode** is the bigger sibling of Random fact: long-pressing that button cycles a simulated walk (off, 1x, 5x, 20x) that drives `src/facts/demoRoute.ts` positions through the normal trigger, Wikipedia, LLM and speech path, so facts fire on their own indoors. It has no on-screen control by design — the `demo` log line is the only signal — and it resets on every launch.
- `src/location/useWalkLocation.ts` requests foreground permission and streams positions tuned for walking pace. Background tracking is not implemented yet even though `app.json` already declares the permissions and background modes.
- `src/facts/proximity.ts` holds the pure trigger logic: haversine distance, `pickNextFact` (nearest untriggered POI within radius, preferring one that carries a selected tag), and `nextUpcoming` (the nearest place still out of range, for the "Next up" status hint). Keep it free of React and Expo imports so it stays unit-testable under Node.
- `src/facts/demoRoute.ts` is the pure half of demo mode: `buildDemoRoute` makes a ~400 m loop around the last real fix (the CN Tower without one) and `positionAlongRoute` interpolates along it, wrapping so a demo runs indefinitely. `WalkScreen` ticks it once a second at `1.4 m/s × speed` and substitutes the result for the GPS fix; nothing downstream knows the difference. Keep it free of React and Expo imports.
- `src/facts/preferences.ts` is the pure half of personalisation: the default tags and `summariseFeedback`, which compresses likes and dislikes into one line for the LLM prompt. `src/facts/preferenceStore.ts` is the Expo half, persisting selected tags in the secure store.
- `src/facts/wikipedia.ts` queries Wikipedia's keyless geosearch API directly from the app and maps articles to `PointOfInterest` (`src/facts/types.ts`). `WalkScreen` refetches after moving ~300 m and merges results with `src/facts/torontoSeed.ts`, a few hand-written facts kept for testing. There is no backend yet; one is only needed once keyed sources (Google Maps, Reddit) or LLM generation arrive.
- `src/speech/narrator.ts` is the one entry point for speaking (`narrate(text, apiKey)`); it resolves when audio finishes so the screen can serialise narration. With a key it uses Gemini speech: `geminiTts.ts` discovers a speech model the key can use via ListModels (so Google renaming models does not break the app), synthesises with the `TTS_VOICE` prebuilt voice, and `wav.ts` wraps the returned PCM in a WAV header without decoding it; `player.ts` writes the WAV to the cache dir and plays it with `expo-audio`. Any failure, or no key, falls back to the device engine via `expo-speech` with the best installed English voice. `geminiTts.ts` and `wav.ts` are pure (no Expo imports) and unit-tested.
- `src/llm/` is bring-your-own-key LLM rewriting. `settings.ts` stores the user's key in `expo-secure-store`. `rewriteFact.ts` fixes the provider (Gemini via its OpenAI-compatible endpoint; switching providers means changing `LLM_BASE_URL`/`LLM_MODEL`), and turns a raw extract into 1-3 spoken sentences just before narration; it throws or returns null on failure and `WalkScreen` falls back to the raw text. Keep it free of Expo and app imports (including `log`) so it stays testable under Node. It also takes an optional `Steering` argument carrying the fact's tag and the feedback summary, so the prompt leans towards what the user asked for without loosening the grounding rule. With no key saved, raw Wikipedia text is narrated. `src/screens/SettingsPanel.tsx` is the key entry UI, presented as a bottom sheet.
- `src/theme/tokens.ts` holds the Nocturne design tokens (dark ground, Inter-ish system type, accent `#9184d9` used as line and glow, never a large fill). Primary actions are outlined, not filled; do not reintroduce solid green/red buttons. All screen styles read from these tokens. `src/screens/FactCard.tsx` is the hero card, with a `PanResponder` swipe (past +/-90 px commits like or dislike, shown by a heart or cross glyph that fades in with the drag; a tap replays the fact), an animated speaking glow, and the equaliser bars. The card's swipe springs run on the JS driver deliberately: the glow animates borderColor and shadow on the same view, and React Native cannot mix native- and JS-driven values on one node. Safe areas come from `react-native-safe-area-context` (`SafeAreaProvider` in `App.tsx`), since React Native's own `SafeAreaView` is deprecated. `src/screens/TuneSheet.tsx` exports both the tag sheet and the shared `BottomSheet`. Two design details are deliberately flattened to avoid new dependencies, per the handoff: the card's gradient is a flat surface colour and the list's end-fading rule is a plain hairline. Restoring them means adding `expo-linear-gradient`; Inter would mean `@expo-google-fonts/inter`. Icons use `@expo/vector-icons` (Feather set, bundled with Expo Go) rather than text glyphs, which rendered thin and misaligned on Android; the swipe stamps are still Unicode glyphs sized large enough not to matter.
- `src/log.ts` is the only logging path (`log(tag, ...)` / `logError(tag, err)`). Output appears in the terminal running `expo start` while the phone is connected. Log key events (location, wikipedia, trigger, narrate, llm, settings) and every caught error; never log the API key.
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

Tests use Node's built-in runner, so test files and any pure module they import use explicit `.ts` extensions on relative imports (`allowImportingTsExtensions` is on; Metro accepts them too). Modules under test must not import React Native or Expo. They are excluded from `tsc` in `tsconfig.json`. There is no linter configured.

## Open questions to resolve before building the relevant piece

- Trigger distance and behaviour in dense areas with many points of interest.
- Google Maps pricing and terms for a future public release.
- Reddit API access terms and rate limits.
- Second-language support (Montreal) is deferred.
