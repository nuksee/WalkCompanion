# Handoff: WalkCompanion walk screen — "Now playing" redesign

## Overview

A redesign of WalkCompanion's single screen (`app/src/screens/WalkScreen.tsx`). The current screen is a light-themed stack of Start/Stop, Random fact, a status line and a list of heard facts. The redesign makes the **most recently spoken fact the hero of the screen**, adds the two roadmap-step-4 personalisation mechanics (fact-type tags, like/dislike), and moves everything onto the Nocturne dark theme.

Implements roadmap step 4 from `intent.md`: tag preferences and like/dislike feedback, with a tag attached to every fact.

## About the design files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behaviour, not production code to copy. The task is to recreate them in this repo's existing environment: **React Native + Expo (TypeScript)**, `StyleSheet.create` styles, no UI library, no new dependencies unless a step actually needs them (per `CLAUDE.md`).

Two files:

- `WalkCompanion Current.dc.html` — a faithful recreation of the screen as it exists today. Reference only; do not port.
- `WalkCompanion Redesign.dc.html` — the target design. Marked `1b` in the file.

Both are HTML/React prototypes with an Android device frame around them. Ignore the frame, the page chrome, the option label, and the intro paragraph — only the content inside the phone is the design.

## Fidelity

**High-fidelity.** Colors, typography, spacing, radii and interaction states below are final. Recreate pixel-accurately in React Native, translating CSS to `StyleSheet` equivalents. The design system (Nocturne) is dark; the app currently declares `"userInterfaceStyle": "light"` in `app.json` — that needs to change to `"dark"`, and `<StatusBar style="dark" />` in `WalkScreen.tsx` becomes `style="light"`.

## Screen: Walk

**Purpose.** Start and stop a walk; hear facts hands-free; when the user does look at the phone, see the fact just spoken, react to it, and glance back at earlier ones.

**Layout** — one full-height column, `paddingHorizontal: 20`, safe-area top. Top to bottom:

| # | Block | Height | Notes |
|---|---|---|---|
| 1 | Header row | 48 | Title left, settings icon button right |
| 2 | Status line | 24 | Dot + text, `marginTop: 4` |
| 3 | Hero fact card | 292 | `marginTop: 10`; swipeable |
| 4 | Reaction row | 44 | 3 circular buttons, centered, `gap: 16`, `marginTop: 14` |
| 5 | Primary action row | 52 | Start/Stop + Tune, `gap: 8`, `marginTop: 16` |
| 6 | "Earlier on this walk" header | ~20 | `marginTop: 18`; Random fact ghost button right |
| 7 | Earlier list | flex: 1 | Scrolls; rows separated by a hairline |
| 8 | Tune sheet | overlay | Bottom sheet, hidden by default |

### 1. Header

- Title `WalkCompanion` — Inter 18 / weight 500 / letterSpacing -0.18 (−0.01em) / `#e9e9ed`.
- Settings button — 36×36 ghost icon button, Phosphor `gear` at 20×20, `#b2b6ca`. Opens the existing `SettingsPanel` (API key). **Not designed in this bundle** — keep today's panel, restyled to the tokens below, or present it as a bottom sheet matching the Tune sheet.

### 2. Status line

Row, `gap: 8`, font 12 / `#9397ab`. Leading 6×6 dot:

| State | Dot | Text |
|---|---|---|
| Idle, nothing heard | `#595d6c` | `27 places loaded` |
| Idle, after a walk | `#595d6c` | `Walk ended · 27 places loaded` |
| Walking, no fix | `#5d5294` | `Waiting for a GPS fix…` |
| Walking, idle | `#5d5294` | `43.64260, -79.38710 · ±12 m · 27 places loaded` |
| Approaching | `#5d5294` | `Next up · Old City Hall · 160 m` |
| Speaking | `#9184d9` | `Speaking · Old City Hall` |
| Queue exhausted | `#5d5294` | `Nothing new nearby · keep walking` |

Coordinates come from the existing `position` (5 dp) and accuracy (rounded m), place count from `pois.length`.

### 3. Hero fact card

The card shows the fact currently being spoken; once speech ends it stays as "Last heard". Tapping a row in the Earlier list swaps the card to that fact ("Earlier" kicker).

- Container 292 tall, `borderRadius: 14`, background `linear-gradient(160deg, #232532, #292b31)` (React Native: `expo-linear-gradient`, or a flat `#232532` if avoiding the dependency), 1px border `#3f424d`, `padding: 18px 20px`, children `gap: 8`.
- A second, static card peeks behind it: same radius, `#292b31` at 50% opacity, inset 8 left/right, 8 down from the top, 8 below the bottom — a deck-of-cards hint.
- Row 1: kicker `NOW PLAYING` / `LAST HEARD` / `EARLIER` — 10px, letterSpacing 1.0 (0.1em), uppercase, `#9184d9`; right-aligned tag pill — 11px, `paddingVertical: 3`, `paddingHorizontal: 10`, radius 6, background `#3f424d`, text `#f3f5fe`.
- Place name — 24 / weight 500 / lineHeight 27.6 / letterSpacing −0.36 / `#e9e9ed`, `marginTop: 6`.
- Fact body — 15 / lineHeight 22.5 / `#cfd3e5`, `flex: 1`.
- Footer row: source line 12 / `#9397ab` — `Rewritten by Gemini · 118 m away` when a key is set, `Wikipedia · 118 m away` otherwise (`why` is the trigger reason already logged today: `${Math.round(distance)}m away` or `random`). Right: a 4-bar equaliser, bars 3×14 radius 2 `#9184d9`, each scaling Y 0.35→1→0.35 over 900 ms, staggered 0/150/300/450 ms, `transformOrigin: bottom`. Visible only while speaking.
- While speaking, the card pulses: box-shadow cycling `0 0 0 1px #9184d9, 0 0 18px rgba(145,132,217,.25)` → `0 0 0 1px #b5abfc, 0 0 40px rgba(145,132,217,.5)` over 1600 ms, ease-in-out, infinite. In React Native use `shadowColor: '#9184d9'` with an animated `shadowOpacity`/`shadowRadius` (iOS) and an animated border color (Android, which has no colored elevation).

**Empty state** (no fact heard yet): same 292 box, no fill, 1px dashed `#3f424d`, centered column `gap: 8`: Phosphor `sparkle` 28×28 in `#595d6c`, then 13 / lineHeight 19.5 / `#9397ab` text —
- not walking: `Start a walk. The fact for each place you pass shows here, read aloud.`
- walking, no fix: `Waiting for a GPS fix…`
- walking, fix: `Listening for places nearby…`

**Swipe to react.** Horizontal drag moves the card: `translateX(dx)` plus `rotate(dx / 22 deg)`. Two stamps fade in with the drag, `opacity = clamp(|dx| / 80, 0, 1)`:
- Right (like) — top-left, rotated −8°, `MORE LIKE THIS`, 12px uppercase letterSpacing 0.96, 1.5px border + text `#9184d9`, radius 6, padding 4/10.
- Left (dislike) — top-right, rotated +8°, `LESS OF THIS`, border `#b2b6ca`, text `#cfd3e5`.

Release past **±90 px** commits the reaction; otherwise the card springs back (`transform` 280 ms `cubic-bezier(.2,.8,.2,1)`; RN: `Animated.spring`). A committed reaction keeps its stamp visible at full opacity. Reacting again with the same value clears it (toggle). Use `PanResponder` or `react-native-gesture-handler` — `PanResponder` avoids a new dependency.

### 4. Reaction row

Three 44×44 circular buttons, centered, `gap: 16`. Disabled look (opacity 0.35) when no fact is showing.

| Button | Style | Icon | Action |
|---|---|---|---|
| Less of this | 1px `rgba(233,233,237,.16)` border, transparent | X, 18×18, 1.6 stroke, `#e9e9ed` | toggle dislike |
| Hear again | 1px `#9184d9` border, transparent, `#9184d9` | Play triangle 16×16 | re-`narrate` the shown fact |
| More like this | 1px `rgba(233,233,237,.16)` border | Heart 18×18 filled | toggle like; turns `#9184d9` when set |

44×44 is the minimum hit target; keep it.

### 5. Primary action row

- **Start walk / Stop walk** — `flex: 1`, height 52, radius 8, transparent fill, 1px border `#9184d9`, text 16 / weight 500 / `#9184d9`. Leading 10×10 dot in `currentColor`: a circle when idle, a 2px-radius square while walking. Pressed: fill `rgba(145,132,217,.22)`.
- **Tune · N** — height 52, `paddingHorizontal: 16`, 1px border `rgba(233,233,237,.16)`, text 14 / `#e9e9ed`. N is the number of selected tags, or `all` when none. Opens the Tune sheet.

Nocturne rule: primary actions are outlined, never filled. Do not reintroduce the current green/red solid buttons — the walking state is carried by the dot glyph, the label, and the status line.

### 6–7. Earlier on this walk

- Section header 11 / letterSpacing 0.88 / uppercase / `#9397ab`; on the right a ghost **Random fact** button, 12px `#9184d9`, height 28 — the existing home-test path, unchanged.
- Rows: `paddingVertical: 10`, name 14 / weight 500 / one line with ellipsis; sub-line 11 / `#9397ab` — `${tag} · ${HH:MM}`. Right side shows `More like this` (`#9184d9`) or `Less of this` (`#b2b6ca`) when reacted, nothing otherwise.
- Separator: a 1px bottom rule that fades to transparent over the outer 48 px on each side (`linear-gradient(to right, transparent, rgba(233,233,237,.16) 48px, rgba(233,233,237,.16) calc(100% - 48px), transparent)`). This end-fade is a Nocturne signature. In React Native, `expo-linear-gradient` with `locations`, or accept a flat 1px `rgba(233,233,237,.16)` rule if avoiding the dependency.
- Tapping a row makes it the hero card.
- Empty: 12 / `#75798c` — `Facts you pass appear here for replay.`
- The list excludes whatever is currently in the hero card.

### 8. Tune sheet

Bottom sheet over a scrim of `#292b31` at 60%.

- Sheet: background `#232532`, top corners radius 14, `padding: 12px 20px 24px`, `gap: 14`, shadow `0 0 0 1px #9397ab, 0 16px 40px rgba(0,0,0,.65)`.
- Grab handle 36×4, radius 2, `#595d6c`, centered.
- Title `What do you want to hear?` — 18 / weight 500. Sub `Nothing selected means history and architecture first.` — 12 / `#9397ab`.
- Tag chips, wrapping row, `gap: 8`, each height 34, `paddingHorizontal: 14`, radius 6, 13px. Selected: background `#423a6a`, text `#f5f4ff`. Unselected: background `#3f424d`, text `#f3f5fe`.
- Tags, in order: History, Architecture, Fun fact, Pop culture, Famous people, Hidden gem, Local tips. Default selection: History + Architecture (matches the default priority in `intent.md`).
- **Done** — outlined primary, full width, height 44.

## Interactions & behavior

Simulated in the prototype; in the app these hang off the real pipeline in `WalkScreen.tsx`.

| Trigger | Behavior |
|---|---|
| Start walk | Clear history, request fix, begin `useWalkLocation` stream. Prototype fakes a fix after 1.5 s. |
| Approaching a POI | Status shows `Next up · <name> · <metres>`, counting down. Real app: derive from `pickNextFact` distance rather than a timer. |
| Within `radiusMeters` | `speakFact` runs: LLM rewrite if a key is set, then `narrate`. Card animates in as hero with the `NOW PLAYING` kicker and pulsing glow; equaliser bars animate. |
| Speech ends | Kicker becomes `LAST HEARD`, glow and bars stop. Existing `speaking.current` flag already tracks this. |
| Stop walk | Stop narration, stop location, status becomes `Walk ended · N places loaded`. History stays. |
| Random fact | Same shared `speakFact` path as today, including the Wikipedia prefetch when no `wiki-` POIs are loaded. Keep it on that path. |
| Swipe / tap react | Record `'like' | 'dislike' | null` on the fact. Toggling the same value clears it. Persist per `intent.md`: device is the source of truth; send a compact summary with each LLM request. |
| Tag toggle | Updates preferences immediately; affects ranking of the next candidate and the tag the LLM is asked to write toward. |

**Tag on every fact.** Each fact carries a tag shown on the card and in the list. `PointOfInterest.category` (`history | architecture | culture | trivia`) is the seed — widen it to a `tags: FactTag[]` field covering the seven labels above, as `CLAUDE.md` anticipates. Display rule used by the design: the first of the fact's tags that the user has selected, else the fact's first tag.

## State

Additions to what `WalkScreen` already holds (`walking`, `position`, `history`, `pois`, `busy`, `narratedIds`, `speaking`, `apiKey`):

- `tags: FactTag[]` — selected preferences. Persist across launches (`expo-secure-store` is already a dependency, or `AsyncStorage`).
- `reactions: Record<string, 'like' | 'dislike'>` — keyed by the narrated-fact key (`${poi.id}-${at}`, already the list key today).
- `shownKey: string | null` — which fact the hero card displays; defaults to the newest.
- `sheetOpen: boolean`.
- Existing `NarratedFact` gains `tag: FactTag` and `why: string` (the trigger reason, already computed and logged — surface it in the card footer).

## Design tokens (Nocturne)

Colors

| Token | Hex | Used for |
|---|---|---|
| bg | `#161826` | screen ground |
| surface | `#232532` | card, sheet |
| text | `#e9e9ed` | primary text |
| accent | `#9184d9` | primary outline, kicker, glow, like |
| accent-200 | `#e7e5fe` | text on accent tint |
| accent-700 | `#5d5294` | idle status dot |
| accent-800 | `#423a6a` | selected chip fill |
| neutral-300 | `#cfd3e5` | body copy |
| neutral-400 | `#b2b6ca` | icon, dislike label |
| neutral-500 | `#9397ab` | muted text |
| neutral-600 | `#75798c` | faintest text |
| neutral-700 | `#595d6c` | idle dot, handle |
| neutral-800 | `#3f424d` | card border, neutral chip |
| neutral-900 | `#292b31` | card gradient end, scrim |
| divider | `rgba(233,233,237,.16)` | rules, secondary borders |

Do not use pure black or white. Accent is a line and a glow, never a large fill.

Type — Inter throughout (`expo-font` + `@expo-google-fonts/inter`, weights 400/500). Headings cap at weight 500. Sizes used: 24 / 18 / 16 / 15 / 14 / 13 / 12 / 11 / 10.

Spacing — 0.7× scale: 2.8 / 5.6 / 8.4 / 11.2 / 16.8 / 22.4, rounded to the layout table above.

Radius — 4 small, 8 default, 14 large (card, sheet).

Elevation — dark ground: a hairline border plus ambient darkness. `sm` = 1px `#3f424d`; `md` = 1px `#595d6c` + `0 6px 18px rgba(0,0,0,.55)`; `lg` = 1px `#9397ab` + `0 16px 40px rgba(0,0,0,.65)`. Don't stack shadows.

## Assets

- Icons: [Phosphor](https://phosphoricons.com) — `gear`, `sparkle`, `heart`, plus a plain X and a play triangle drawn inline. Add `phosphor-react-native`, or inline the SVG paths (they're in the prototype source) with `react-native-svg`, which Expo already provides.
- Fonts: Inter, Google Fonts.
- No images.

## Files in this bundle

- `WalkCompanion Redesign.dc.html` — the target design (open in a browser; press Start walk to see the state machine run).
- `WalkCompanion Current.dc.html` — recreation of today's screen, for before/after comparison.
- `android-frame.jsx`, `support.js`, `_ds/` — supporting files the two HTML prototypes load. Not part of the design.

Source files this touches: `app/src/screens/WalkScreen.tsx` (all of the above), `app/src/screens/SettingsPanel.tsx` (restyle to the tokens), `app/src/facts/types.ts` (tags), `app/app.json` (`userInterfaceStyle: "dark"`).
