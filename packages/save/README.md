# @taipeistudio/gamekit-save

[![npm](https://img.shields.io/npm/v/@taipeistudio/gamekit-save.svg)](https://www.npmjs.com/package/@taipeistudio/gamekit-save) [![license](https://img.shields.io/badge/license-MIT%20with%20attribution-blue.svg)](LICENSE)

Save slots for browser games: one autosave per playthrough, numbered manual slots, an index
for load menus, versioned migrations, export/import, and record collections.

## Installation

```bash
npm install @taipeistudio/gamekit-save
```

## Usage

```ts
import { SaveManager, openStore, createAutosaver, settingsStore, downloadText, manualSlot } from "@taipeistudio/gamekit-save";

const saves = new SaveManager(await openStore("my-game"), {
  format: "my-game",
  version: 3,
  prefix: "mg",                           // keys: mg:index, mg:save:<slot>, mg:<collection>
  id: (s) => s.id,
  meta: (s) => ({ name: s.name, level: s.level }),   // shown in load menus
  migrations: { 1: (s) => { s.gold ??= 0 }, 2: (s) => { /* … */ } },
  validate: (s) => ("name" in (s as object) ? null : "missing name"),
  blockManual: (s) => (s.ironman ? "Ironman only autosaves" : null),
});

const autosave = createAutosaver(() => saves.autosave(state), 300);
autosave.schedule();                       // call after every change
await saves.save(state, manualSlot(1), "manual");
const list = await saves.list();           // newest first, meta flattened in
const loaded = await saves.load(list[0].slot);   // migrated to the current version
downloadText("save.json", saves.exportText(state));
const hof = saves.collection<Record>("hof", { key: (r) => r.id, sort: (a, b) => b.score - a.score });
const settings = settingsStore("mg:settings", { sound: true });
```

`openStore` uses IndexedDB (large quota), falling back to localStorage, then memory.
`memoryStore()` is for tests.

## License

MIT with attribution. Part of [gamekit](https://github.com/rosdyana/gamekit).
Copyright © 2026 Rosdyana Kusuma. See [LICENSE](LICENSE); products using this package must
credit the author (e.g. "gamekit by Rosdyana Kusuma - https://github.com/rosdyana/gamekit").
