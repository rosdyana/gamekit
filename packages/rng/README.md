# @taipeistudio/gamekit-rng

[![npm](https://img.shields.io/npm/v/@taipeistudio/gamekit-rng.svg)](https://www.npmjs.com/package/@taipeistudio/gamekit-rng) [![license](https://img.shields.io/badge/license-MIT%20with%20attribution-blue.svg)](LICENSE)

Seeded (mulberry32), serialisable randomness. Keep `{ rngState }` inside your save and the
future replays identically after a reload.

## Installation

```bash
npm install @taipeistudio/gamekit-rng
```

## Usage

```ts
import { holder, next, chance, int, pick, pickWeighted, shuffle, gauss, seed, asFn, mulberry32 } from "@taipeistudio/gamekit-rng";

const state = { rngState: holder(42).rngState, gold: 0 }; // any object with rngState
if (chance(state, 0.3)) state.gold += int(state, 1, 6);
const reward = pickWeighted(state, [["sword", 1], ["potion", 5]]);
const matchRand = mulberry32(seed(state));  // throwaway sub-simulation
const fn = asFn(state);                      // () => number for libraries
```

Every helper accepts either a holder or a plain `() => number`.

## License

MIT with attribution. Part of [gamekit](https://github.com/rosdyana/gamekit).
Copyright © 2026 Rosdyana Kusuma. See [LICENSE](LICENSE); products using this package must
credit the author (e.g. "gamekit by Rosdyana Kusuma - https://github.com/rosdyana/gamekit").
