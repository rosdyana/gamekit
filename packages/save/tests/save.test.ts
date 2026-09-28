import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { autoSlot, createAutosaver, manualSlot, memoryStore, migrateState, openStore, SaveManager } from "../src";

interface Game {
  version: number;
  id: string;
  name: string;
  hardcore: boolean;
  gold: number;
}

const cfg = {
  format: "test-game",
  version: 2,
  prefix: "tg",
  id: (s: Game) => s.id,
  meta: (s: Game) => ({ name: s.name, gold: s.gold }),
  migrations: { 1: (s: Record<string, unknown>) => void (s.gold = (s.coins as number) ?? 0) },
  validate: (s: unknown) => (typeof (s as Game).name === "string" ? null : "missing name"),
  blockManual: (s: Game) => (s.hardcore ? "Hardcore only autosaves" : null),
};

const game = (o: Partial<Game> = {}): Game => ({ version: 2, id: "g1", name: "Hero", hardcore: false, gold: 5, ...o });

describe("SaveManager", () => {
  it("autosaves, indexes and reloads", async () => {
    const saves = new SaveManager(memoryStore(), cfg);
    await saves.autosave(game());
    const list = await saves.list();
    expect(list[0]).toMatchObject({ slot: autoSlot("g1"), kind: "auto", name: "Hero", gold: 5, id: "g1" });
    expect(await saves.load(autoSlot("g1"))).toEqual(game());
  });

  it("keeps the exact storage layout (keys, file shape)", async () => {
    const store = memoryStore();
    await new SaveManager(store, cfg).save(game(), manualSlot(2), "manual");
    expect((await store.keys("tg:")).sort()).toEqual(["tg:index", "tg:save:manual-2"]);
    const file = JSON.parse((await store.get("tg:save:manual-2"))!);
    expect(Object.keys(file)).toEqual(["format", "version", "meta", "state"]);
  });

  it("blocks manual saves when configured", async () => {
    const saves = new SaveManager(memoryStore(), cfg);
    await expect(saves.save(game({ hardcore: true }), manualSlot(1), "manual")).rejects.toThrow(/Hardcore/);
  });

  it("migrates and validates", () => {
    expect(migrateState({ version: 1, name: "Old", coins: 9 }, cfg)).toMatchObject({ version: 2, gold: 9 });
    expect(() => migrateState({ version: 3 }, cfg)).toThrow(/newer/);
    expect(() => migrateState({ version: 2 }, cfg)).toThrow(/missing name/);
    expect(() => migrateState({ version: 0, name: "x" }, cfg)).toThrow(/upgrade path/);
  });

  it("round-trips export/import and rejects foreign files", async () => {
    const saves = new SaveManager(memoryStore(), cfg);
    expect(await saves.importText(saves.exportText(game({ gold: 77 })))).toMatchObject({ gold: 77 });
    await expect(saves.importText("{nope")).rejects.toThrow(/valid/);
    await expect(saves.importText('{"format":"other","state":{}}')).rejects.toThrow(/Not a save/);
  });

  it("supports a custom id field and removeAll", async () => {
    const saves = new SaveManager(memoryStore(), { ...cfg, idKey: "careerId" });
    await saves.autosave(game());
    await saves.save(game(), manualSlot(1), "manual");
    expect((await saves.list())[0]).toHaveProperty("careerId", "g1");
    await saves.removeAll("g1");
    expect(await saves.list()).toHaveLength(0);
  });

  it("stores record collections with upsert and upgrade", async () => {
    const saves = new SaveManager(memoryStore(), cfg);
    const hof = saves.collection<{ id: string; score: number; v?: number }>("hof", {
      key: (e) => e.id,
      upgrade: (e) => ({ ...e, v: 2 }),
      sort: (a, b) => b.score - a.score,
    });
    await hof.upsert({ id: "a", score: 1 });
    await hof.upsert({ id: "b", score: 5 });
    await hof.upsert({ id: "a", score: 9 });
    expect(await hof.all()).toEqual([
      { id: "a", score: 9, v: 2 },
      { id: "b", score: 5, v: 2 },
    ]);
  });

  it("works over IndexedDB", async () => {
    const saves = new SaveManager(await openStore("gamekit-test"), cfg);
    await saves.autosave(game({ gold: 3 }));
    expect(await saves.load(autoSlot("g1"))).toMatchObject({ gold: 3 });
  });
});

describe("createAutosaver", () => {
  it("coalesces bursts into one write", async () => {
    vi.useFakeTimers();
    const write = vi.fn(async () => {});
    const a = createAutosaver(write, 100);
    a.schedule();
    a.schedule();
    a.schedule();
    vi.advanceTimersByTime(150);
    expect(write).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
