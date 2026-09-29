import type { Rand } from "./util.js";

// ---------------------------------------------------------------- Elo

/** Probability that A beats B. `scale` 400 is chess; smaller = more decisive. */
export const expected = (ra: number, rb: number, scale = 400) => 1 / (1 + Math.pow(10, (rb - ra) / scale));

/** New ratings after a game. `scoreA` 1 = win, 0.5 = draw, 0 = loss. */
export function eloUpdate(ra: number, rb: number, scoreA: number, k = 20, scale = 400): [number, number] {
  const ea = expected(ra, rb, scale);
  return [ra + k * (scoreA - ea), rb + k * (1 - scoreA - (1 - ea))];
}

/** Quick winner between two rated sides. */
export const eloWinner = <T>(rand: Rand, a: T, b: T, ra: number, rb: number, scale = 400): T =>
  rand() < expected(ra, rb, scale) ? a : b;

// ---------------------------------------------------------------- scorelines

/** Knuth's method; fine for the small means of sports scores. */
export function poisson(rand: Rand, mean: number): number {
  const l = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > l && k < 30);
  return k - 1;
}

export interface ScoreOptions {
  /** Average total goals in an even match (football ≈ 2.7). */
  avgTotal?: number;
  /** Elo scale used to split the goal expectation. */
  scale?: number;
  /** Home advantage in rating points. */
  homeEdge?: number;
}

/** A plausible low-scoring scoreline (football, hockey…) from two ratings. */
export function scoreline(rand: Rand, ra: number, rb: number, o: ScoreOptions = {}): [number, number] {
  const total = o.avgTotal ?? 2.7;
  const e = expected(ra + (o.homeEdge ?? 0), rb, o.scale ?? 400);
  // Stronger sides score more and concede less; keep the total roughly stable.
  const share = 0.5 + (e - 0.5) * 1.2;
  const a = Math.max(0.15, total * share);
  const b = Math.max(0.15, total * (1 - share));
  return [poisson(rand, a), poisson(rand, b)];
}

export interface HighScoreOptions {
  /** Average points per team in an even game (NBA ≈ 114, FIBA ≈ 80). */
  avgPoints?: number;
  /** Standard deviation of one team's score. */
  spread?: number;
  /** Rating points per point of expected margin (Elo-like; 28 ≈ one point per 28 Elo). */
  perPoint?: number;
  /** Home advantage in rating points. */
  homeEdge?: number;
  /** Points per overtime period, on average, for each side. */
  overtime?: number;
}

/**
 * A plausible high-scoring, no-tie scoreline (basketball, handball) from two ratings:
 * normal noise around the average, the rating gap shifts the margin, ties go to overtime.
 * Returns [a, b, overtimes].
 */
export function highScore(rand: Rand, ra: number, rb: number, o: HighScoreOptions = {}): [number, number, number] {
  const avg = o.avgPoints ?? 112;
  const sd = o.spread ?? 11;
  const margin = (ra + (o.homeEdge ?? 0) - rb) / (o.perPoint ?? 28);
  const n = () => (rand() + rand() + rand() + rand() - 2) * Math.sqrt(3) * sd;
  let a = Math.round(avg + margin / 2 + n());
  let b = Math.round(avg - margin / 2 + n());
  let ots = 0;
  const ot = o.overtime ?? 10;
  const m = expected(ra + (o.homeEdge ?? 0), rb);
  while (a === b && ots < 6) {
    ots++;
    const base = Math.round(ot * (0.7 + rand() * 0.6));
    const d = rand() < m ? 1 : -1;
    const gap = 1 + Math.floor(rand() * 6);
    a += base + (d > 0 ? gap : 0);
    b += base + (d < 0 ? gap : 0);
  }
  return [Math.max(0, a), Math.max(0, b), ots];
}

// ---------------------------------------------------------------- two legs

export interface Leg {
  homeScore: number;
  awayScore: number;
}

export interface TieResult<T> {
  winner: T;
  legs: [Leg, Leg];
  aggregate: [number, number];
  /** "aggregate" or "decider" (extra time / penalties / replay). */
  decidedBy: "aggregate" | "decider";
}

/**
 * Two-legged tie: A hosts leg one, B hosts leg two. Level on aggregate goes
 * to `decider` (away goals were abolished by UEFA in 2021; add them yourself).
 */
export function twoLegs<T>(
  a: T,
  b: T,
  playLeg: (home: T, away: T, leg: 1 | 2) => Leg,
  decider: (a: T, b: T) => T,
): TieResult<T> {
  const l1 = playLeg(a, b, 1);
  const l2 = playLeg(b, a, 2);
  const aggA = l1.homeScore + l2.awayScore;
  const aggB = l1.awayScore + l2.homeScore;
  if (aggA !== aggB) return { winner: aggA > aggB ? a : b, legs: [l1, l2], aggregate: [aggA, aggB], decidedBy: "aggregate" };
  return { winner: decider(a, b), legs: [l1, l2], aggregate: [aggA, aggB], decidedBy: "decider" };
}

/** Penalty shoot-out: best of five, then sudden death. */
export function penalties(rand: Rand, pa = 0.75, pb = 0.75): { a: number; b: number; aWins: boolean } {
  let a = 0;
  let b = 0;
  for (let i = 0; i < 5; i++) {
    if (rand() < pa) a++;
    if (a > b + (5 - i)) break;
    if (rand() < pb) b++;
    if (b > a + (4 - i)) break;
  }
  while (a === b) {
    const sa = rand() < pa;
    const sb = rand() < pb;
    a += sa ? 1 : 0;
    b += sb ? 1 : 0;
  }
  return { a, b, aWins: a > b };
}
