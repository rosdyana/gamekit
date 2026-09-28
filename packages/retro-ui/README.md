# @taipeistudio/gamekit-retro-ui

[![npm](https://img.shields.io/npm/v/@taipeistudio/gamekit-retro-ui.svg)](https://www.npmjs.com/package/@taipeistudio/gamekit-retro-ui) [![license](https://img.shields.io/badge/license-MIT%20with%20attribution-blue.svg)](LICENSE)

Retro pixel UI for Preact games: components plus one stylesheet.

## Installation

```bash
npm install @taipeistudio/gamekit-retro-ui preact
```

## Usage

```ts
import "@taipeistudio/gamekit-retro-ui/style.css";   // then <body class="rui">
import { Button, Panel, Meter, Stat, Tabs, Choice, Swatches, CardButton, Field,
  Modal, ConfirmDialog, Toasts, Tag, Empty, money, plural,
  configureUi, createStore, useStore, TimingBar, gradeFromOffset, simulateGrade } from "@taipeistudio/gamekit-retro-ui";

configureUi({ click: () => sfx.click() });        // sound on every press
const store = createStore();                       // for games that mutate state in place
function Hud() { useStore(store); return <Panel title="Stats"><Meter value={hp} tone="red" /></Panel>; }

const bar = new TimingBar(document.querySelector("#hud")!);
const grade = await bar.run({ perfect: 0.1, good: 0.28, duration: 1 }); // "perfect" | "good" | "poor" | "whiff" | null
```

- Theme tokens (`--ink`, `--bg`, `--panel`, `--gold`, `--red`, `--green`, `--blue`…) are CSS
  variables on `.rui`; override them in your own CSS. Font: `--rui-font` (default
  "Press Start 2P"; bundle it with `@fontsource/press-start-2p`).
- Rules are scoped with `:where(.rui)`: zero specificity, so your stylesheet always wins.
- `.stage` is a 16:9 container that sizes text in `cqw`, so the UI scales with the screen.
- Utility classes: `muted small big gold green red row column gap wrap right hidden blink`.

## License

MIT with attribution. Part of [gamekit](https://github.com/rosdyana/gamekit).
Copyright © 2026 Rosdyana Kusuma. See [LICENSE](LICENSE); products using this package must
credit the author (e.g. "gamekit by Rosdyana Kusuma - https://github.com/rosdyana/gamekit").
