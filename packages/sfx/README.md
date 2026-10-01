# @taipeistudio/gamekit-sfx

[![npm](https://img.shields.io/npm/v/@taipeistudio/gamekit-sfx.svg)](https://www.npmjs.com/package/@taipeistudio/gamekit-sfx) [![license](https://img.shields.io/badge/license-MIT%20with%20attribution-blue.svg)](LICENSE)

Synthesised game sound on WebAudio. No audio files, no dependencies: sound effects are a few
lines of data, and anything that drones (an engine, a siren, wind, a crowd) follows a value
from your game.

## Installation

```bash
npm install @taipeistudio/gamekit-sfx
```

## Usage

```ts
import { createSfx, notes, gearing } from "@taipeistudio/gamekit-sfx";

export const sfx = createSfx({
  volume: 0.5,
  cues: {
    click: { hz: 520, time: 0.04, vol: 0.08 },
    jump: { wave: "triangle", hz: 220, to: 520, time: 0.22, vol: 0.12 },
    // Several steps play together; `at` staggers them.
    crash: [
      { kind: "noise", hz: 2600, to: 120, time: 0.7, vol: 0.6 },
      { wave: "sawtooth", hz: 160, to: 30, time: 0.5, vol: 0.25 },
    ],
    goal: [{ kind: "noise", filter: "bandpass", hz: 1000, time: 2.2, vol: 0.12, swell: true }, ...notes([523, 659, 784, 1047], { at: 0.1 })],
  },
});

// Browsers only allow sound after a key press or a tap.
addEventListener("pointerdown", () => sfx.unlock(), { once: true });

sfx.play("crash"); // typed: only the names above
sfx.play({ hz: 880, time: 0.3 }); // or a cue made on the spot
sfx.toggleMute();
sfx.volume = 0.8;
```

### Cues

A cue is one step or an array of steps.

| Step | Fields | Good for |
| --- | --- | --- |
| tone | `wave` (square), `hz`, `to`, `time`, `vol`, `at` | beeps, whistles, jumps, coins, jingles |
| noise (`kind: "noise"`) | `filter` (lowpass), `hz`, `to`, `q`, `time`, `vol`, `at`, `swell` | hits, crashes, explosions, splashes, crowds |

`notes([523, 659, 784], { time, gap, vol, wave, at })` builds a run of tones.

### Voices

A voice never stops; it starts silent and you steer it every frame. Voices made before
`unlock()` remember what they were told.

```ts
const engine = sfx.voice({ wave: "sawtooth", layers: [{ wave: "square", ratio: 0.5 }], filter: { type: "lowpass", hz: 900 } });
const tyres = sfx.voice({ wave: "noise", filter: { type: "bandpass", hz: 700 } });

function frame(speed: number, throttle: boolean, offroad: boolean) {
  const { gear, revs } = gearing(speed, 4); // the note climbs through each gear
  engine.set({ hz: 58 + gear * 14 + revs * 62, vol: throttle ? 0.16 : 0.09 });
  tyres.set({ vol: offroad ? 0.05 + speed * 0.2 : 0 });
}

sfx.hush(); // every voice to silence: pause, game over, back to the menu
```

The same two pieces cover other games: a tank's diesel and tracks, a propeller whose pitch
follows the throttle, wind that rises with altitude (`cutoff`), a stadium crowd whose volume
follows the excitement of the match.

`sfx.time` is the audio clock, for things that alternate on a beat (a two-tone siren:
`Math.floor(sfx.time * 2.2) % 2 ? 660 : 880`).

## License

MIT with attribution. Part of [gamekit](https://github.com/rosdyana/gamekit).
Copyright © 2026 Rosdyana Kusuma. See [LICENSE](LICENSE); products using this package must
credit the author (e.g. "gamekit by Rosdyana Kusuma - https://github.com/rosdyana/gamekit").
