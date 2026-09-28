/**
 * Single-elimination brackets as plain, save-friendly data.
 * `rounds[0]` is the full draw; `rounds[i + 1]` holds the winners of round i.
 * A `null` slot is a bye (the other entrant walks through).
 */
export interface Knockout<T> {
  rounds: (T | null)[][];
}

export const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(2, n)));

/** Positions of seeds 1..n so that the top seeds can only meet late. */
export function seedOrder(n: number): number[] {
  let order = [1, 2];
  while (order.length < n) {
    const size = order.length * 2;
    order = order.flatMap((x) => [x, size + 1 - x]);
  }
  return order;
}

/**
 * Place entrants (strongest first) into a bracket of `size` (default: next
 * power of two), filling the rest with byes that go to the top seeds.
 */
export function seedBracket<T>(bySeed: readonly T[], size = nextPow2(bySeed.length)): (T | null)[] {
  const padded: (T | null)[] = [...bySeed.slice(0, size)];
  while (padded.length < size) padded.push(null);
  return seedOrder(size).map((s) => padded[s - 1]);
}

export const knockout = <T>(slots: (T | null)[]): Knockout<T> => ({ rounds: [slots] });

export const currentRound = <T>(ko: Knockout<T>) => ko.rounds[ko.rounds.length - 1];

export const isFinished = <T>(ko: Knockout<T>) => currentRound(ko).length === 1;

export const champion = <T>(ko: Knockout<T>): T | null => (isFinished(ko) ? currentRound(ko)[0] : null);

export function pairs<T>(ko: Knockout<T>): [T | null, T | null][] {
  const r = currentRound(ko);
  const out: [T | null, T | null][] = [];
  for (let i = 0; i < r.length; i += 2) out.push([r[i], r[i + 1]]);
  return out;
}

/**
 * Play the current round. `decide` is only called for real matches; byes and
 * `override` entries (pair index -> winner, e.g. the human's match) skip it.
 */
export function playRound<T>(
  ko: Knockout<T>,
  decide: (a: T, b: T, pairIndex: number) => T,
  override: Map<number, T | null> = new Map(),
): (T | null)[] {
  if (isFinished(ko)) throw new Error("Knockout already finished");
  const winners = pairs(ko).map(([a, b], i) => {
    if (override.has(i)) return override.get(i)!;
    if (a === null) return b;
    if (b === null) return a;
    return decide(a, b, i);
  });
  ko.rounds.push(winners);
  return winners;
}

export function playOut<T>(ko: Knockout<T>, decide: (a: T, b: T, pairIndex: number) => T): T | null {
  while (!isFinished(ko)) playRound(ko, decide);
  return champion(ko);
}

/** Index of the round an entrant went out in (rounds.length - 1 for the champion), or -1. */
export function exitRound<T>(ko: Knockout<T>, who: T): number {
  if (!ko.rounds[0].includes(who)) return -1;
  for (let i = 1; i < ko.rounds.length; i++) if (!ko.rounds[i].includes(who)) return i - 1;
  return ko.rounds.length - 1;
}

/** Human label for a round with `left` entrants remaining: Final, Semi-final, Round of 16… */
export function roundLabel(left: number): string {
  if (left <= 1) return "Champion";
  if (left === 2) return "Final";
  if (left === 4) return "Semi-final";
  if (left === 8) return "Quarter-final";
  return `Round of ${left}`;
}

/** Short code: W, F, SF, QF, R16, R32… */
export function roundCode(left: number): string {
  if (left <= 1) return "W";
  if (left === 2) return "F";
  if (left === 4) return "SF";
  if (left === 8) return "QF";
  return `R${left}`;
}

/** Round codes for a draw size, earliest first: 32 -> [R32, R16, QF, SF, F]. */
export function roundCodes(drawSize: number): string[] {
  const out: string[] = [];
  for (let left = drawSize; left >= 2; left /= 2) out.push(roundCode(left));
  return out;
}

/** The code of how far an entrant got: W for the champion, else the round they lost in. */
export function reached<T>(ko: Knockout<T>, who: T): string | null {
  const i = exitRound(ko, who);
  if (i < 0) return null;
  return roundCode(ko.rounds[i].length);
}
