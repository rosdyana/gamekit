import type { Rand } from "./util.js";

/**
 * Entry drafts: weighted lottery for the top picks, then reverse standings, over rounds.
 */

/** NBA odds (per 1000) for the 14 non-playoff teams, worst first, for the #1 pick. */
export const NBA_LOTTERY_ODDS = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5];

export interface Lottery<T> {
  /** Final order of the lottery teams (pick 1 first). */
  order: T[];
  /** Lottery teams that jumped into the drawn picks: team -> pick (1-based). */
  jumps: { team: T; from: number; to: number }[];
}

/**
 * Draw `drawn` picks by weight (without replacement) among `teams` (worst record first,
 * weights from `odds`, same order); everyone else keeps reverse-standing order.
 */
export function draftLottery<T>(teams: readonly T[], rand: Rand, odds: readonly number[] = NBA_LOTTERY_ODDS, drawn = 4): Lottery<T> {
  const pool = teams.map((t, i) => ({ t, w: odds[i] ?? 0, i }));
  const won: typeof pool = [];
  for (let k = 0; k < Math.min(drawn, pool.length); k++) {
    const total = pool.reduce((a, x) => a + (won.includes(x) ? 0 : Math.max(0, x.w)), 0);
    if (total <= 0) break;
    let roll = rand() * total;
    for (const x of pool) {
      if (won.includes(x)) continue;
      roll -= Math.max(0, x.w);
      if (roll <= 0) {
        won.push(x);
        break;
      }
    }
  }
  const order = [...won, ...pool.filter((x) => !won.includes(x))];
  return {
    order: order.map((x) => x.t),
    jumps: order.flatMap((x, to) => (to < x.i ? [{ team: x.t, from: x.i + 1, to: to + 1 }] : [])),
  };
}

export interface Pick<T> {
  round: number;
  /** Pick within the round and overall (both 1-based). */
  pick: number;
  overall: number;
  /** Team using the pick (after trades). */
  team: T;
  /** Team the pick originally belonged to. */
  original: T;
}

/**
 * Full draft order over `rounds`. Round 1 uses `firstRound` (e.g. lottery order then
 * playoff teams by record); later rounds use `laterRounds` (default: the same order).
 * `owner(original, round)` lets traded picks change hands.
 */
export function draftOrder<T>(
  firstRound: readonly T[],
  rounds = 2,
  laterRounds: readonly T[] = firstRound,
  owner: (original: T, round: number) => T = (t) => t,
): Pick<T>[] {
  const out: Pick<T>[] = [];
  for (let r = 1; r <= rounds; r++) {
    const list = r === 1 ? firstRound : laterRounds;
    list.forEach((original, i) => out.push({ round: r, pick: i + 1, overall: out.length + 1, team: owner(original, r), original }));
  }
  return out;
}

/**
 * Teams pick in order from a big board: `pick(team, available)` returns the index of the
 * prospect taken (defaults to best available). Returns selections in pick order.
 */
export function runDraft<T, P>(
  picks: readonly Pick<T>[],
  board: readonly P[],
  pick: (team: T, available: readonly P[], p: Pick<T>) => number = () => 0,
): { pick: Pick<T>; player: P }[] {
  const avail = [...board];
  const out: { pick: Pick<T>; player: P }[] = [];
  for (const p of picks) {
    if (!avail.length) break;
    const i = Math.max(0, Math.min(avail.length - 1, pick(p.team, avail, p)));
    out.push({ pick: p, player: avail.splice(i, 1)[0] });
  }
  return out;
}
