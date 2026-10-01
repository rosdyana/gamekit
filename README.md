<div align="center">

# gamekit

**Small, focused TypeScript engines for browser games.**

Seeded randomness · save systems · retro UI · sports competitions · life-sim events · athlete careers

[![license](https://img.shields.io/badge/license-MIT%20with%20attribution-blue.svg)](LICENSE)
[![types](https://img.shields.io/badge/types-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)
[![ESM](https://img.shields.io/badge/module-ESM-f7df1e.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)

</div>

---

gamekit is a monorepo of six independent packages extracted from shipped games. Each package
does one job, has no dependency on the others, and keeps its state as plain, serialisable data
so it drops straight into a save file. Anything random takes a `rand: () => number`, so every
simulation can be replayed from a seed.

## Packages

| Package | Version | Description |
| --- | --- | --- |
| [`@taipeistudio/gamekit-rng`](packages/rng) | [![npm](https://img.shields.io/npm/v/@taipeistudio/gamekit-rng.svg)](https://www.npmjs.com/package/@taipeistudio/gamekit-rng) | Seeded RNG whose state lives in your save (replays exactly); chance, int, pick, weighted pick, shuffle, gauss, string hash |
| [`@taipeistudio/gamekit-save`](packages/save) | [![npm](https://img.shields.io/npm/v/@taipeistudio/gamekit-save.svg)](https://www.npmjs.com/package/@taipeistudio/gamekit-save) | IndexedDB/localStorage stores, autosave and manual slots, versioned migrations, export/import, record collections, settings, debounced autosaver |
| [`@taipeistudio/gamekit-retro-ui`](packages/retro-ui) | [![npm](https://img.shields.io/npm/v/@taipeistudio/gamekit-retro-ui.svg)](https://www.npmjs.com/package/@taipeistudio/gamekit-retro-ui) | Pixel-style Preact kit and stylesheet: panels, buttons, chips, cards, meters, tabs, modals, toasts, 16:9 stage, timing-bar minigame |
| [`@taipeistudio/gamekit-competition`](packages/competition) | [![npm](https://img.shields.io/npm/v/@taipeistudio/gamekit-competition.svg)](https://www.npmjs.com/package/@taipeistudio/gamekit-competition) | Knockouts, round-robin fixtures, league tables with tiebreaks, constrained group draws, Swiss league phase, promotion/relegation, two-legged ties, penalties, best-of-N series, play-in, divisional schedules with back-to-backs, draft lottery, Elo, Poisson and high scorelines, rolling rankings |
| [`@taipeistudio/gamekit-events`](packages/events) | [![npm](https://img.shields.io/npm/v/@taipeistudio/gamekit-events.svg)](https://www.npmjs.com/package/@taipeistudio/gamekit-events) | Life-sim event deck (weighted, conditional, cooldowns, once-only, scheduled, choices with tags), calendar/season/age helpers, curves, named meters |
| [`@taipeistudio/gamekit-career`](packages/career) | [![npm](https://img.shields.io/npm/v/@taipeistudio/gamekit-career.svg)](https://www.npmjs.com/package/@taipeistudio/gamekit-career) | Athlete-career economy: money helpers, taxes, currency, savings/index/crypto/property/business portfolio with weekly markets, sponsors with image clauses, fame and followers, lifestyle ladders, tiers |
| [`@taipeistudio/gamekit-sfx`](packages/sfx) | [![npm](https://img.shields.io/npm/v/@taipeistudio/gamekit-sfx.svg)](https://www.npmjs.com/package/@taipeistudio/gamekit-sfx) | Synthesised WebAudio sound with no audio files: data-driven one-shot cues (tones, filtered noise, note runs), continuous voices that follow a game value (engines, sirens, wind, crowds), unlock, mute, master volume |

Looking for sprites? The companion library [**pixel-rig**](https://github.com/rosdyana/pixel-rig)
draws procedural, animated pixel-art characters.

## Installation

Install only the packages you need:

```bash
npm install @taipeistudio/gamekit-rng @taipeistudio/gamekit-save @taipeistudio/gamekit-competition @taipeistudio/gamekit-events
npm install @taipeistudio/gamekit-career
npm install @taipeistudio/gamekit-retro-ui preact   # UI kit (Preact is a peer dependency)
```

All packages are ESM only, ship their own type definitions and are meant to be used with a
bundler (Vite, webpack, esbuild, etc.).

For the UI kit, import the stylesheet once and put `class="rui"` on `<body>`:

```ts
import "@taipeistudio/gamekit-retro-ui/style.css";
```

## Example: a football career

The packages compose into a full season loop: league, continental cups, promotion and
relegation, and a relationship model for the player.

```ts
import { holder, asFn } from "@taipeistudio/gamekit-rng";
import {
  roundRobin, table, record, standings,
  drawGroups, groupStage, qualifiers, crossOver,
  knockout, playRound, twoLegs, penalties, scoreline,
  swissDraw, promoteRelegate, allocate,
} from "@taipeistudio/gamekit-competition";
import { calendar, seasonOf, curve, nudge, settle, band } from "@taipeistudio/gamekit-events";

const state = { rngState: holder(1234).rngState /* …your career state… */ };
const rand = asFn(state);
const rating = (club: string) => clubs[club].elo;
const play = (home: string, away: string) => {
  const [hs, as] = scoreline(rand, rating(home), rating(away), { homeEdge: 60 });
  return { homeScore: hs, awayScore: as };
};

// League season: double round robin, 3-1-0, goal difference.
const fixtures = roundRobin(leagueClubs, { double: true, rand });
const league = table(leagueClubs);
for (const day of fixtures) for (const f of day) record(league, { ...f, ...play(f.home, f.away) });
const final = standings(league);

// Group stage: 4 pots into 8 groups, no two clubs from one country.
const groups = drawGroups(pots, 8, rand, (a, b) => clubs[a].country === clubs[b].country);
const cup = groupStage(groups, { double: true });
// …record group fixtures like the league, then:
const q = qualifiers(cup, 2, ["points", "headToHead", "goalDifference", "goalsFor"]);
const ko = knockout(crossOver(q.map((g) => g[0].team), q.map((g) => g[1].team)));
playRound(ko, (a, b) => twoLegs(a, b, play, (x, y) => (penalties(rand).aWins ? x : y)).winner);

// Swiss league phase (2024+ format): one 36-team table, 2 opponents per pot, 8 matchdays.
const phase = swissDraw(cupPots, rand, { conflict: (a, b) => clubs[a].country === clubs[b].country });

// End of season: promotion/relegation (3 up, 3 down) and continental places.
const nextTiers = promoteRelegate([top.map((r) => r.team), second.map((r) => r.team)], 3);
const places = allocate(final.map((r) => r.team), [{ key: "cl", count: 4 }, { key: "el", count: 2 }]);

// Seasons run August to May; ageing curves and relationships.
const cal = calendar(2026);
seasonOf(cal, week, 32).label; // "2026/27"
const growth = curve([[15, 0.45], [20, 0.8], [25, 1], [30, 1], [34, 0.85]]);
const rel = { coach: 50, fans: 50 };
nudge(rel, "coach", +10);
settle(rel, { coach: 50, fans: 50 }, 0.05); // drift back toward neutral weekly
band(rel.coach, [[0, "Hostile"], [30, "Cold"], [55, "Warm"], [80, "Close"]]);
```

Each package README documents its full API.

## Development

```bash
git clone https://github.com/rosdyana/gamekit.git
cd gamekit
npm install

npm test        # all package tests (vitest; jsdom + fake-indexeddb where needed)
npm run check   # typecheck + tests
npm run build   # dist/ for every package
```

### Local linking

To develop gamekit alongside a game, install the packages from disk:

```bash
npm install ../gamekit/packages/rng ../gamekit/packages/save
```

Linked packages are symlinks, so rebuild gamekit after edits. With Vite, dedupe shared peers
so linked packages don't bundle a second copy:

```ts
// vite.config.ts
export default defineConfig({ resolve: { dedupe: ["preact", "pixi.js"] } });
```

Issues and pull requests are welcome at
[github.com/rosdyana/gamekit/issues](https://github.com/rosdyana/gamekit/issues).

## License

Released under the **MIT License with an attribution requirement**. See [LICENSE](LICENSE).

You may use, modify, distribute and sell software that includes gamekit, including in
commercial games, provided that:

1. the copyright notice and license are kept in all copies and modified versions, and
2. your product visibly credits the author (credits screen, About page, documentation or
   store listing), for example:

   > gamekit by Rosdyana Kusuma - https://github.com/rosdyana/gamekit

Copyright © 2026 [Rosdyana Kusuma](https://github.com/rosdyana).
