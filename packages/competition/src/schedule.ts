import type { Fixture, Row } from "./league.js";
import { shuffle, type Rand } from "./util.js";

/**
 * Conference/division schedules (NBA, NHL, NFL style) and a day-by-day calendar with
 * back-to-backs. `plan*` builds the list of games; `scheduleDays` lays them out.
 */

/** How many times each pair meets: [a, b, games]. */
export type Matchups<T> = [T, T, number][];

export interface LeagueShape<T> {
  /** Conferences, each a list of divisions, each a list of teams. */
  conferences: T[][][];
}

export interface PlanCounts {
  /** Games against each division rival. */
  division: number;
  /** Games against non-division conference teams: `confHigh` against `confHighCount` of them, `confLow` against the rest. */
  confHigh: number;
  confLow: number;
  confHighCount: number;
  /** Games against every team in the other conference(s). */
  interConf: number;
}

/** 82 games for 30 teams in 2 conferences x 3 divisions x 5 teams. */
export const NBA_COUNTS: PlanCounts = { division: 4, confHigh: 4, confLow: 3, confHighCount: 6, interConf: 2 };

/**
 * Pair counts for a divisional league. Non-division conference opponents come from other
 * divisions of equal size; each team plays `confHigh` games against `confHighCount` of them,
 * spread evenly over the other divisions by a rotating circulant (random offset per pair of
 * divisions), so every team gets exactly the same count.
 */
export function planDivisional<T>(shape: LeagueShape<T>, counts: PlanCounts, rand?: Rand): Matchups<T> {
  const out: Matchups<T> = [];
  const confs = shape.conferences;
  for (const conf of confs) {
    for (const div of conf) for (let i = 0; i < div.length; i++) for (let j = i + 1; j < div.length; j++) out.push([div[i], div[j], counts.division]);
    const others = conf.length - 1;
    if (others > 0 && counts.confHighCount % others !== 0) throw new Error("confHighCount must split evenly over the other divisions");
    const perDiv = others ? counts.confHighCount / others : 0;
    for (let d = 0; d < conf.length; d++) {
      for (let e = d + 1; e < conf.length; e++) {
        const A = conf[d];
        const B = conf[e];
        if (A.length !== B.length) throw new Error("Divisions in a conference must be the same size");
        if (perDiv > A.length) throw new Error("confHighCount too large");
        const n = A.length;
        const off = rand ? Math.floor(rand() * n) : 0;
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) {
            const high = (j - i - off + 2 * n) % n < perDiv;
            out.push([A[i], B[j], high ? counts.confHigh : counts.confLow]);
          }
      }
    }
  }
  for (let c = 0; c < confs.length; c++)
    for (let k = c + 1; k < confs.length; k++)
      for (const a of confs[c].flat()) for (const b of confs[k].flat()) out.push([a, b, counts.interConf]);
  return out;
}

/** Games per team in a plan. */
export function gamesPerTeam<T>(plan: Matchups<T>): Map<T, number> {
  const m = new Map<T, number>();
  for (const [a, b, n] of plan) {
    m.set(a, (m.get(a) ?? 0) + n);
    m.set(b, (m.get(b) ?? 0) + n);
  }
  return m;
}

/**
 * Turn pair counts into fixtures with balanced home/away: even counts split evenly, odd
 * counts give the extra home game alternately (by pair order) so season totals stay level.
 */
export function expandMatchups<T>(plan: Matchups<T>): Fixture<T>[] {
  const out: Fixture<T>[] = [];
  const extra = new Map<T, number>();
  for (const [a, b, n] of plan) {
    let homeA = Math.floor(n / 2);
    if (n % 2) {
      // Give the odd game to whoever has had fewer extra home games so far.
      const ea = extra.get(a) ?? 0;
      const eb = extra.get(b) ?? 0;
      if (ea <= eb) {
        homeA++;
        extra.set(a, ea + 1);
      } else extra.set(b, eb + 1);
    }
    for (let i = 0; i < n; i++) out.push(i < homeA ? { home: a, away: b } : { home: b, away: a });
  }
  return out;
}

export interface DayOptions {
  /** Days available (default: enough for everyone, about twice the games per team). */
  days?: number;
  /** Never three games in three days (default true). */
  noThreeInThree?: boolean;
  /** Fraction of teams that may play on one day (default 1: everyone). */
  load?: number;
}

/**
 * Lay fixtures out on days: nobody plays twice on a day, games spread evenly (teams with
 * the most games left go first), optional no-three-in-three. Returns one list per day
 * (days may be empty). Throws if the fixtures don't fit in `days`.
 */
export function scheduleDays<T>(fixtures: readonly Fixture<T>[], rand: Rand, o: DayOptions = {}): Fixture<T>[][] {
  const left = new Map<T, number>();
  for (const f of fixtures) {
    left.set(f.home, (left.get(f.home) ?? 0) + 1);
    left.set(f.away, (left.get(f.away) ?? 0) + 1);
  }
  const teams = left.size;
  const most = Math.max(0, ...left.values());
  const days = o.days ?? Math.ceil(most * 2.05) + 2;
  const perDay = Math.max(1, Math.floor((teams * (o.load ?? 1)) / 2));
  const noThree = o.noThreeInThree ?? true;
  let pool = shuffle(rand, fixtures);
  const last = new Map<T, number[]>();
  const out: Fixture<T>[][] = [];
  for (let d = 0; d < days && pool.length; d++) {
    const daysLeft = days - d;
    // Urgency: games left per day left; urgent teams must play today.
    pool.sort((x, y) => (left.get(y.home)! + left.get(y.away)!) - (left.get(x.home)! + left.get(x.away)!));
    const busy = new Set<T>();
    const today: Fixture<T>[] = [];
    const rest: Fixture<T>[] = [];
    for (const f of pool) {
      const ok = (t: T) => {
        if (busy.has(t)) return false;
        if (!noThree) return true;
        const l = last.get(t) ?? [];
        return !(l.includes(d - 1) && l.includes(d - 2));
      };
      const urgent = left.get(f.home)! >= daysLeft * 0.5 || left.get(f.away)! >= daysLeft * 0.5;
      const wantRest = (t: T) => (last.get(t) ?? []).includes(d - 1) && left.get(t)! < daysLeft * 0.42;
      if (today.length < perDay && ok(f.home) && ok(f.away) && (urgent || (!wantRest(f.home) && !wantRest(f.away)))) {
        today.push(f);
        busy.add(f.home);
        busy.add(f.away);
        for (const t of [f.home, f.away]) {
          left.set(t, left.get(t)! - 1);
          last.set(t, [...(last.get(t) ?? []).slice(-2), d]);
        }
      } else rest.push(f);
    }
    out.push(today);
    pool = rest;
  }
  if (pool.length) throw new Error(`${pool.length} games did not fit in ${days} days`);
  return out;
}

/** Back-to-backs (games on consecutive days) for one team. */
export function backToBacks<T>(days: readonly Fixture<T>[][], team: T): number {
  let n = 0;
  let prev = -2;
  days.forEach((day, d) => {
    if (day.some((f) => f.home === team || f.away === team)) {
      if (prev === d - 1) n++;
      prev = d;
    }
  });
  return n;
}

// ---------------------------------------------------------------- win-loss tables

/** Win-loss leagues: pass to `table(teams, WIN_LOSS)`; points then equal wins. */
export const WIN_LOSS = { win: 1, draw: 0, loss: 0 };

export const winPct = (r: Row<unknown>) => (r.played ? r.won / r.played : 0);

/** Games behind a leader: ((leader W - W) + (L - leader L)) / 2. */
export const gamesBehind = (leader: Row<unknown>, r: Row<unknown>) => (leader.won - r.won + (r.lost - leader.lost)) / 2;

/** "W-L" record string. */
export const winLoss = (r: Row<unknown>) => `${r.won}-${r.lost}`;
