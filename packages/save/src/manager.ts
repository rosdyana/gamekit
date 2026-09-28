import type { Store } from "./store.js";

export type Migration = (state: Record<string, unknown>) => void;

export interface SaveConfig<S, M extends object> {
  /** File format tag, checked on import (e.g. "my-game"). */
  format: string;
  /** Current state version; older saves run through `migrations`. */
  version: number;
  /** Key prefix, e.g. "bc" -> "bc:index", "bc:save:<slot>". */
  prefix: string;
  /** Unique id of a playthrough (one autosave slot per id). */
  id: (state: S) => string;
  /** Small summary shown in load menus. Flattened into the index entry. */
  meta: (state: S) => M;
  /** migrations[n] upgrades a version-n state to n + 1 (mutate in place). */
  migrations?: Record<number, Migration>;
  /** Final shape check after migrating; return an error message to reject. */
  validate?: (state: unknown) => string | null;
  /** Return a reason to refuse manual saves (e.g. Ironman mode). */
  blockManual?: (state: S) => string | null;
  /** Index field that stores the id (default "id"). */
  idKey?: string;
}

export type SlotKind = "auto" | "manual";

export type SlotEntry<M extends object> = M & {
  slot: string;
  kind: SlotKind;
  savedAt: number;
} & Record<string, unknown>;

interface SaveFile<S, M> {
  format: string;
  version: number;
  meta: M;
  state: S;
}

export const autoSlot = (id: string) => `auto-${id}`;
export const manualSlot = (n: number) => `manual-${n}`;

/** Upgrade a raw state to the current version (throws on anything unusable). */
export function migrateState<S>(raw: unknown, cfg: Pick<SaveConfig<S, object>, "version" | "migrations" | "validate">): S {
  if (!raw || typeof raw !== "object") throw new Error("Save file is empty or corrupt");
  const state = raw as Record<string, unknown>;
  let v = Number(state.version);
  if (!Number.isFinite(v)) throw new Error("Not a valid save (missing version)");
  if (v > cfg.version) throw new Error("This save comes from a newer version of the game");
  while (v < cfg.version) {
    const m = cfg.migrations?.[v];
    if (!m) throw new Error(`No upgrade path from save version ${v}`);
    m(state);
    v++;
    state.version = v;
  }
  const err = cfg.validate?.(state);
  if (err) throw new Error(err);
  return state as S;
}

/**
 * Save slots over any Store: one autosave per playthrough, numbered manual
 * slots, an index for load menus, export/import and record collections.
 */
export class SaveManager<S extends { version?: number }, M extends object> {
  private readonly idKey: string;

  constructor(
    readonly store: Store,
    private readonly cfg: SaveConfig<S, M>,
  ) {
    this.idKey = cfg.idKey ?? "id";
  }

  private get indexKey() {
    return `${this.cfg.prefix}:index`;
  }

  private fileKey(slot: string) {
    return `${this.cfg.prefix}:save:${slot}`;
  }

  /** Newest first. Never throws: a corrupt index reads as empty. */
  async list(): Promise<SlotEntry<M>[]> {
    try {
      const raw = await this.store.get(this.indexKey);
      const list = raw ? (JSON.parse(raw) as SlotEntry<M>[]) : [];
      return list.sort((a, b) => b.savedAt - a.savedAt);
    } catch {
      return [];
    }
  }

  entry(state: S, slot: string, kind: SlotKind): SlotEntry<M> {
    return {
      ...this.cfg.meta(state),
      [this.idKey]: this.cfg.id(state),
      slot,
      kind,
      savedAt: Date.now(),
    } as SlotEntry<M>;
  }

  async save(state: S, slot: string, kind: SlotKind): Promise<SlotEntry<M>> {
    if (kind === "manual") {
      const why = this.cfg.blockManual?.(state);
      if (why) throw new Error(why);
    }
    const meta = this.entry(state, slot, kind);
    const file: SaveFile<S, SlotEntry<M>> = { format: this.cfg.format, version: this.cfg.version, meta, state };
    await this.store.set(this.fileKey(slot), JSON.stringify(file));
    const list = (await this.list()).filter((m) => m.slot !== slot);
    list.push(meta);
    await this.store.set(this.indexKey, JSON.stringify(list));
    return meta;
  }

  autosave(state: S) {
    return this.save(state, autoSlot(this.cfg.id(state)), "auto");
  }

  async load(slot: string): Promise<S> {
    const raw = await this.store.get(this.fileKey(slot));
    if (!raw) throw new Error("That save slot is empty");
    let file: SaveFile<unknown, unknown>;
    try {
      file = JSON.parse(raw);
    } catch {
      throw new Error("That save file is corrupt");
    }
    return migrateState<S>(file.state, this.cfg);
  }

  async remove(slot: string) {
    await this.store.del(this.fileKey(slot));
    const list = (await this.list()).filter((m) => m.slot !== slot);
    await this.store.set(this.indexKey, JSON.stringify(list));
  }

  /** Delete every slot belonging to one playthrough. */
  async removeAll(id: string) {
    for (const m of await this.list()) if (m[this.idKey] === id) await this.remove(m.slot);
  }

  exportText(state: S): string {
    const file: SaveFile<S, SlotEntry<M>> = {
      format: this.cfg.format,
      version: this.cfg.version,
      meta: this.entry(state, autoSlot(this.cfg.id(state)), "auto"),
      state,
    };
    return JSON.stringify(file);
  }

  /** Parse, check format, migrate, and autosave an exported file. */
  async importText(text: string): Promise<S> {
    let parsed: Partial<SaveFile<unknown, unknown>>;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("That file is not a valid save");
    }
    if (parsed.format !== this.cfg.format || !parsed.state) throw new Error("Not a save file for this game");
    const state = migrateState<S>(parsed.state, this.cfg);
    await this.autosave(state);
    return state;
  }

  /** A named list of records (hall of fame, trophies…) next to the saves. */
  collection<T>(name: string, opts: CollectionOptions<T> = {}) {
    return new Collection<T>(this.store, `${this.cfg.prefix}:${name}`, opts);
  }
}

export interface CollectionOptions<T> {
  /** Unique key: upsert replaces the record with the same key. */
  key?: (item: T) => string;
  /** Upgrade old records on read (keep it idempotent). */
  upgrade?: (item: T) => T;
  sort?: (a: T, b: T) => number;
}

export class Collection<T> {
  constructor(
    private readonly store: Store,
    private readonly storageKey: string,
    private readonly opts: CollectionOptions<T>,
  ) {}

  async all(): Promise<T[]> {
    try {
      const raw = await this.store.get(this.storageKey);
      const list = raw ? (JSON.parse(raw) as T[]) : [];
      const up = this.opts.upgrade ? list.map(this.opts.upgrade) : list;
      return this.opts.sort ? up.sort(this.opts.sort) : up;
    } catch {
      return [];
    }
  }

  async upsert(item: T) {
    const k = this.opts.key;
    const list = (await this.all()).filter((x) => !k || k(x) !== k(item));
    list.push(item);
    await this.store.set(this.storageKey, JSON.stringify(list));
  }

  async remove(key: string) {
    const k = this.opts.key;
    if (!k) return;
    await this.store.set(this.storageKey, JSON.stringify((await this.all()).filter((x) => k(x) !== key)));
  }
}
