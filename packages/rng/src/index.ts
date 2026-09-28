/**
 * Seeded, serialisable randomness.
 *
 * Two styles, same generator (mulberry32):
 * - Stateful holder: keep `{ rngState }` inside your save so a reload replays
 *   the exact same future. `next(holder)` advances it.
 * - Plain function: `mulberry32(seed)` returns `() => number` for throwaway
 *   sub-simulations (one match, one crowd).
 */
export type Rand = () => number;

export interface RngHolder {
  rngState: number;
}

export function mulberry32(seed: number): Rand {
  const h: RngHolder = { rngState: seed >>> 0 };
  return () => next(h);
}

export function next(h: RngHolder): number {
  h.rngState = (h.rngState + 0x6d2b79f5) >>> 0;
  let t = h.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A holder seeded from a number (or randomly). */
export const holder = (seed: number = Math.floor(Math.random() * 2 ** 31)): RngHolder => ({ rngState: seed >>> 0 });

/** Adapter: a holder as a plain function. */
export const asFn = (h: RngHolder): Rand => () => next(h);

type Src = RngHolder | Rand;
const draw = (r: Src) => (typeof r === "function" ? r() : next(r));

export const chance = (r: Src, p: number) => draw(r) < p;
export const between = (r: Src, lo: number, hi: number) => lo + (hi - lo) * draw(r);
/** Integer in [lo, hi] inclusive. */
export const int = (r: Src, lo: number, hi: number) => Math.floor(between(r, lo, hi + 1));
export const pick = <T>(r: Src, xs: readonly T[]): T => xs[Math.floor(draw(r) * xs.length)];
/** A fresh 31-bit seed for a sub-simulation. */
export const seed = (r: Src) => Math.floor(draw(r) * 2 ** 31);

/** Approximately normal noise (sum of three uniforms) with the given std dev. */
export const gauss = (r: Src, sd: number) => (draw(r) + draw(r) + draw(r) - 1.5) * 2 * sd;

export function pickWeighted<T>(r: Src, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((s, [, w]) => s + Math.max(0, w), 0);
  let roll = draw(r) * total;
  for (const [item, w] of items) {
    roll -= Math.max(0, w);
    if (roll <= 0) return item;
  }
  return items[items.length - 1][0];
}

/** Fisher-Yates, returns a new array. */
export function shuffle<T>(r: Src, xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(draw(r) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Stable 32-bit hash of a string: deterministic per-id variety without an rng. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
