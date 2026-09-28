import type { Fixture } from "./league";
import { shuffle, type Rand } from "./util";

export interface SwissOptions<T> {
  /** Opponents drawn from every pot (default 2: one at home, one away). */
  perPot?: number;
  /** Forbid a pairing (e.g. same country). */
  conflict?: (a: T, b: T) => boolean;
  /** Attempts before giving up (default 200). */
  attempts?: number;
}

/** A drawn game as [home, away] team indices. */
type Game = [number, number];

/**
 * League-phase draw: every team meets `perPot` opponents from every pot (its own included), half of them at home,
 * never the same opponent twice, and never a conflicting pairing. The games are laid out as matchdays in which
 * every team plays exactly once. Returns matchdays of fixtures (length = perPot * pots.length).
 * Throws if no valid draw is found within `attempts`.
 *
 * Pots must be the same size. Between two pots each round is a random perfect matching (alternating who hosts);
 * inside a pot a round is a random "i hosts π(i)" permutation, so everyone gets one home and one away. An odd
 * `perPot` adds one extra pairing round per pot (needs even pots) and home/away is then only balanced to ±1.
 * The games are then coloured into matchdays by randomized backtracking, redrawing when that fails.
 */
export function swissDraw<T>(pots: readonly (readonly T[])[], rand: Rand, o: SwissOptions<T> = {}): Fixture<T>[][] {
  const k = o.perPot ?? 2;
  const attempts = o.attempts ?? 200;
  const size = pots[0]?.length ?? 0;
  if (!Number.isInteger(k) || k < 1) throw new Error("perPot must be a whole number >= 1");
  if (pots.length === 0 || size === 0) throw new Error("Need at least one non-empty pot");
  if (pots.some((p) => p.length !== size)) throw new Error("Every pot must have the same number of teams");
  if (pots.length > 1 && k > size) throw new Error(`Cannot meet ${k} different teams from a pot of ${size}`);
  if (k > size - 1) throw new Error(`Cannot meet ${k} different teams from one's own pot of ${size}`);
  if ((pots.length * size) % 2 === 1) throw new Error("Every team plays each matchday, so the team count must be even");
  if (k % 2 === 1 && size % 2 === 1) throw new Error("An odd perPot needs pots with an even number of teams");

  const teams = pots.flat();
  const n = teams.length;
  const ids = pots.map((_, p) => Array.from({ length: size }, (_, i) => p * size + i));
  const bad = o.conflict ? (a: number, b: number) => o.conflict!(teams[a], teams[b]) : () => false;
  const days = k * pots.length;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const games = drawGames(ids, k, bad, rand, n);
    if (!games) continue;
    // A drawn set of games is usually colourable; retry the colouring a few times before redrawing.
    for (let c = 0; c < 8; c++) {
      const layout = colour(games, n, days, rand);
      if (layout) return layout.map((day) => day.map(([h, a]) => ({ home: teams[h], away: teams[a] })));
    }
  }
  throw new Error("No valid league-phase draw found; relax the conflicts or raise attempts");
}

/** Every game of the draw, or null if a pairing round got stuck. */
function drawGames(ids: number[][], k: number, bad: (a: number, b: number) => boolean, rand: Rand, n: number): Game[] | null {
  const met = new Set<number>();
  const key = (a: number, b: number) => (a < b ? a * n + b : b * n + a);
  const free = (a: number, b: number) => a !== b && !met.has(key(a, b)) && !bad(a, b);
  const games: Game[] = [];
  const add = (home: number, away: number) => {
    met.add(key(home, away));
    games.push([home, away]);
  };
  for (let p = 0; p < ids.length; p++) {
    for (let q = p; q < ids.length; q++) {
      const own = p === q;
      // Own pot: each permutation round gives one home and one away; odd perPot adds a pairing round.
      const rounds = own ? Math.floor(k / 2) : k;
      for (let j = 0; j < rounds; j++) {
        const to = matchUp(ids[p], ids[q], free, rand);
        if (!to) return null;
        ids[p].forEach((a, i) => {
          const b = to[i];
          const lastOdd = k % 2 === 1 && j === k - 1;
          const aHosts = own || (lastOdd ? (i + p + q) % 2 === 0 : j % 2 === 0);
          if (aHosts) add(a, b);
          else add(b, a);
        });
      }
      if (own && k % 2 === 1) {
        const pairs = pairUp(ids[p], free, rand);
        if (!pairs) return null;
        pairs.forEach(([a, b], i) => (i % 2 === 0 ? add(a, b) : add(b, a)));
      }
    }
  }
  return games;
}

/** Random perfect matching left[i] -> right[to[i]] with every pairing `ok`, found by backtracking. */
function matchUp(left: number[], right: number[], ok: (a: number, b: number) => boolean, rand: Rand): number[] | null {
  const to: number[] = [];
  const used = new Set<number>();
  const order = shuffle(rand, left.map((_, i) => i));
  const out = new Array<number>(left.length);
  let steps = 0;
  const place = (d: number): boolean => {
    if (d === order.length) return true;
    if (++steps > 20_000) return false;
    const a = left[order[d]];
    for (const b of shuffle(rand, right)) {
      if (used.has(b) || !ok(a, b)) continue;
      // Inside a pot, b -> a later would repeat this pairing.
      if (to.some((x, i) => x === a && left[order[i]] === b)) continue;
      used.add(b);
      to.push(b);
      out[order[d]] = b;
      if (place(d + 1)) return true;
      used.delete(b);
      to.pop();
    }
    return false;
  };
  return place(0) ? out : null;
}

/** Random pairs covering an (even) pot, every pairing `ok`. */
function pairUp(pot: number[], ok: (a: number, b: number) => boolean, rand: Rand): [number, number][] | null {
  const left = new Set(shuffle(rand, pot));
  const out: [number, number][] = [];
  let steps = 0;
  const place = (): boolean => {
    if (left.size === 0) return true;
    if (++steps > 20_000) return false;
    const a = left.values().next().value as number;
    left.delete(a);
    for (const b of shuffle(rand, [...left])) {
      if (!ok(a, b)) continue;
      left.delete(b);
      out.push([a, b]);
      if (place()) return true;
      out.pop();
      left.add(b);
    }
    left.add(a);
    return false;
  };
  return place() ? out : null;
}

/**
 * Colour a regular set of games into matchdays where every team plays once: each day is a
 * random perfect matching of the games still unplaced (most-constrained team first).
 */
function colour(games: Game[], n: number, days: number, rand: Rand): Game[][] | null {
  const byTeam: number[][] = Array.from({ length: n }, () => []);
  games.forEach(([h, a], g) => {
    byTeam[h].push(g);
    byTeam[a].push(g);
  });
  const placed = new Array<boolean>(games.length).fill(false);
  const out: Game[][] = [];
  for (let d = 0; d < days; d++) {
    const busy = new Array<boolean>(n).fill(false);
    const day: number[] = [];
    let steps = 0;
    const options = (t: number) =>
      byTeam[t].filter((g) => !placed[g] && !busy[games[g][0]] && !busy[games[g][1]]);
    const fill = (left: number): boolean => {
      if (left === 0) return true;
      if (++steps > 4_000) return false;
      // The free team with the fewest playable games goes next.
      let pick = -1;
      let best: number[] = [];
      for (let t = 0; t < n; t++) {
        if (busy[t]) continue;
        const opts = options(t);
        if (pick < 0 || opts.length < best.length) {
          pick = t;
          best = opts;
          if (opts.length === 0) return false;
        }
      }
      for (const g of shuffle(rand, best)) {
        const [h, a] = games[g];
        busy[h] = busy[a] = true;
        placed[g] = true;
        day.push(g);
        if (fill(left - 2)) return true;
        busy[h] = busy[a] = false;
        placed[g] = false;
        day.pop();
      }
      return false;
    };
    if (!fill(n)) return null;
    out.push(day.map((g) => games[g]));
  }
  return out;
}
