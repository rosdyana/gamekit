# @taipeistudio/gamekit-events

[![npm](https://img.shields.io/npm/v/@taipeistudio/gamekit-events.svg)](https://www.npmjs.com/package/@taipeistudio/gamekit-events) [![license](https://img.shields.io/badge/license-MIT%20with%20attribution-blue.svg)](LICENSE)

Life-sim events and turn/calendar helpers.

## Installation

```bash
npm install @taipeistudio/gamekit-events
```

## Usage

```ts
import { EventDeck, emptyMemory, calendar, yearOf, weekOfYear, ageAt, seasonOf, curve, clamp, drift, pushLog } from "@taipeistudio/gamekit-events";

const deck = new EventDeck<State, Ctx>([
  {
    id: "interview", title: "Press Interview", weight: 3, cooldown: 6,
    when: (s) => s.fame >= 5,
    text: () => "How far can you go?",
    choices: [
      { label: "Stay humble", apply: (s) => ((s.fame += 1), "+1 fame") },
      { label: "Trash talk", blocked: (s) => (s.banned ? "Suspended" : null), apply: (s, ctx) => (ctx.rand() < 0.5 ? "Viral!" : "Backlash."), tags: ["risky"] },
    ],
  },
]);

state.memory ??= emptyMemory();                     // save it with your state
const e = deck.roll(state, state.memory, turn, rand, 0.2);   // scheduled first, then random
if (e) { deck.text(state, e); deck.resolve(state, ctx, e, choiceIndex, state.memory, turn); }
deck.schedule(state.memory, { id: "callUp", data: { team: "IDN" } }, turn + 2);
```

Events support `weight` (number or function), `when`, `cooldown`, `once`, and choices with
`blocked` and `tags` (react to them, e.g. `"retire"`). Calendar: 52 turns a year by default;
`seasonOf` handles seasons that start mid-year (football, August to May).

Meters are plain `Record<K, number>` gauges for relationships and moods:

```ts
const rel: Meters<"coach" | "fans"> = { coach: 50, fans: 50 };
nudge(rel, "coach", +8);                 // clamped to 0..100 (or your lo/hi), returns new value
settle(rel, { coach: 50, fans: 50 }, 0.1); // weekly drift back toward neutral
band(rel.coach, [[0, "Hostile"], [30, "Cold"], [55, "Warm"], [80, "Close"]]); // "Warm"
```

## License

MIT with attribution. Part of [gamekit](https://github.com/rosdyana/gamekit).
Copyright © 2026 Rosdyana Kusuma. See [LICENSE](LICENSE); products using this package must
credit the author (e.g. "gamekit by Rosdyana Kusuma - https://github.com/rosdyana/gamekit").
