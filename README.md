# WalkCompanion

A hands-free walking tour guide. Start a walk, put your phone in your pocket, and the app narrates short facts about the buildings and places around you as you pass them.

Personal learning project, currently being tested in Toronto. iOS and Android via React Native and Expo.

## What it does today

- Tracks your location while a walk is active.
- Pulls nearby geotagged Wikipedia articles as you move and turns each into a two-sentence fact.
- Speaks a fact aloud when you come within about 120 metres of a place, never repeating one on the same walk.
- Lists everything heard on the walk, with tap to replay.

Planned next: background tracking with the phone locked, local notifications, more sources, and offline city packs. See [intent.md](intent.md) for the full vision and roadmap.

## Run it on your phone

Requirements: Node 22 or newer, and the [Expo Go](https://expo.dev/go) app on your phone.

```bash
cd app
npm install
npm start
```

Scan the QR code with Expo Go. If the phone cannot reach your computer, which is common on corporate or public Wi-Fi, use tunnel mode instead:

```bash
npx expo start --tunnel
```

Tap **Start walk**, allow location access, and head towards a landmark.

## Development

All commands run from `app/`.

```bash
npm run typecheck   # TypeScript check
npm test            # unit tests (Node's built-in runner)
```

Project layout and conventions are documented in [CLAUDE.md](CLAUDE.md).

## Data sources

Facts currently come from the [Wikipedia geosearch API](https://www.mediawiki.org/wiki/API:Geosearch) with a small set of hand-written Toronto seed facts for testing. Every fact records its source URL.
