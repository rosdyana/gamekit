/**
 * Life-sim events: weighted, conditional, with choices that change state.
 * All bookkeeping lives in an `EventMemory` you store in your save.
 */
export type Rand = () => number;

/** An event waiting for the player to choose. Plain data. */
export interface Pending {
  id: string;
  /** Free-form payload (e.g. which tournament a call-up is for). */
  data?: Record<string, unknown>;
}

export interface EventChoice<S, C> {
  label: string;
  /** Return a reason to show the choice disabled. */
  blocked?: (state: S) => string | null;
  /** Apply the outcome; return the text shown to the player. */
  apply: (state: S, ctx: C, event: Pending) => string;
  /** Anything your game wants to react to (e.g. "retire"). */
  tags?: string[];
}

export interface EventDef<S, C = undefined> {
  id: string;
  title: string;
  text: (state: S, event: Pending) => string;
  /** Random events need a weight (number or function of state). Scripted ones omit it. */
  weight?: number | ((state: S) => number);
  when?: (state: S) => boolean;
  /** Turns before the same event can fire again. */
  cooldown?: number;
  /** Fire at most once per playthrough. */
  once?: boolean;
  choices: EventChoice<S, C>[];
}

export interface EventMemory {
  /** Event id -> turn it last fired. */
  last: Record<string, number>;
  /** Scheduled events, fired when their turn arrives. */
  queue: { at: number; event: Pending }[];
}

export const emptyMemory = (): EventMemory => ({ last: {}, queue: [] });

export interface Resolution<S, C> {
  text: string;
  choice: EventChoice<S, C>;
  def: EventDef<S, C>;
}

export class EventDeck<S, C = undefined> {
  private readonly byId: Map<string, EventDef<S, C>>;

  constructor(readonly defs: EventDef<S, C>[]) {
    this.byId = new Map(defs.map((d) => [d.id, d]));
    if (this.byId.size !== defs.length) throw new Error("Duplicate event ids");
  }

  get(id: string): EventDef<S, C> {
    const d = this.byId.get(id);
    if (!d) throw new Error(`Unknown event "${id}"`);
    return d;
  }

  /** Random events that could fire right now, with their weights. */
  eligible(state: S, memory: EventMemory, turn: number): [EventDef<S, C>, number][] {
    const out: [EventDef<S, C>, number][] = [];
    for (const d of this.defs) {
      if (d.weight === undefined) continue;
      const last = memory.last[d.id];
      if (d.once && last !== undefined) continue;
      if (d.cooldown !== undefined && last !== undefined && turn - last < d.cooldown) continue;
      if (d.when && !d.when(state)) continue;
      const w = typeof d.weight === "function" ? d.weight(state) : d.weight;
      if (w > 0) out.push([d, w]);
    }
    return out;
  }

  /**
   * Scheduled events due this turn come first; otherwise, with probability
   * `chance`, draw one eligible random event by weight.
   */
  roll(state: S, memory: EventMemory, turn: number, rand: Rand, chance = 0.2): Pending | null {
    const due = memory.queue.findIndex((q) => q.at <= turn);
    if (due >= 0) return memory.queue.splice(due, 1)[0].event;
    if (rand() >= chance) return null;
    const pool = this.eligible(state, memory, turn);
    const total = pool.reduce((a, [, w]) => a + w, 0);
    let r = rand() * total;
    for (const [d, w] of pool) if ((r -= w) <= 0) return { id: d.id };
    return null;
  }

  schedule(memory: EventMemory, event: Pending, at: number) {
    this.get(event.id);
    memory.queue.push({ at, event });
    memory.queue.sort((a, b) => a.at - b.at);
  }

  text(state: S, event: Pending): string {
    return this.get(event.id).text(state, event);
  }

  /** Apply a choice. Returns null if the index is invalid or the choice is blocked. */
  resolve(state: S, ctx: C, event: Pending, index: number, memory: EventMemory, turn: number): Resolution<S, C> | null {
    const def = this.get(event.id);
    const choice = def.choices[index];
    if (!choice || choice.blocked?.(state)) return null;
    const text = choice.apply(state, ctx, event);
    memory.last[def.id] = turn;
    return { text, choice, def };
  }
}
