/**
 * Best-of-N series (basketball/hockey/baseball playoffs, esports) and the play-in.
 * `a` is the higher seed and gets home court under the default 2-2-1-1-1 pattern.
 */
export interface SeriesGame<T> {
  home: T;
  away: T;
  homeScore: number;
  awayScore: number;
}

export interface Series<T> {
  a: T;
  b: T;
  bestOf: number;
  /** Wins for a and b. */
  wins: [number, number];
  games: SeriesGame<T>[];
  /** Per game: true when `a` hosts. Longer series repeat the last entry's alternation. */
  pattern: boolean[];
}

/** NBA/NHL home-court pattern for the higher seed: games 1, 2, 5 and 7 at home. */
export const HOME_2_2_1_1_1 = [true, true, false, false, true, false, true];
/** MLB/older NBA Finals: 2-3-2. */
export const HOME_2_3_2 = [true, true, false, false, false, true, true];

export function series<T>(a: T, b: T, bestOf = 7, pattern: boolean[] = HOME_2_2_1_1_1): Series<T> {
  if (bestOf < 1 || bestOf % 2 === 0) throw new Error("bestOf must be odd");
  return { a, b, bestOf, wins: [0, 0], games: [], pattern };
}

export const winsNeeded = (s: Series<unknown>) => Math.ceil(s.bestOf / 2);

export const seriesOver = (s: Series<unknown>) => Math.max(...s.wins) >= winsNeeded(s);

export const seriesWinner = <T>(s: Series<T>): T | null =>
  !seriesOver(s) ? null : s.wins[0] > s.wins[1] ? s.a : s.b;

export const seriesLoser = <T>(s: Series<T>): T | null =>
  !seriesOver(s) ? null : s.wins[0] > s.wins[1] ? s.b : s.a;

/** Home and away for the next game (0-based `game`, default the next one to play). */
export function nextGame<T>(s: Series<T>, game = s.games.length): { home: T; away: T } {
  const p = s.pattern;
  const aHome = game < p.length ? p[game] : game % 2 === 0;
  return aHome ? { home: s.a, away: s.b } : { home: s.b, away: s.a };
}

/** Record the next game's score (no ties). */
export function recordGame<T>(s: Series<T>, homeScore: number, awayScore: number): SeriesGame<T> {
  if (seriesOver(s)) throw new Error("Series already over");
  if (homeScore === awayScore) throw new Error("Series games cannot be tied");
  const g = { ...nextGame(s), homeScore, awayScore };
  s.games.push(g);
  const winner = homeScore > awayScore ? g.home : g.away;
  s.wins[winner === s.a ? 0 : 1]++;
  return g;
}

/** Play the rest of the series with `play(home, away) => [homeScore, awayScore]`. */
export function playSeries<T>(s: Series<T>, play: (home: T, away: T, game: number) => [number, number]): T {
  while (!seriesOver(s)) {
    const { home, away } = nextGame(s);
    const [h, w] = play(home, away, s.games.length);
    recordGame(s, h, w);
  }
  return seriesWinner(s)!;
}

/** "Series tied 2-2", "A lead 3-1", "A win 4-2" (names via `name`). */
export function seriesStatus<T>(s: Series<T>, name: (t: T) => string = String): string {
  const [x, y] = s.wins;
  if (x === y) return `Series tied ${x}-${y}`;
  const lead = x > y ? s.a : s.b;
  const hi = Math.max(x, y);
  const lo = Math.min(x, y);
  return `${name(lead)} ${seriesOver(s) ? "win" : "lead"} ${hi}-${lo}`;
}

export interface PlayIn<T> {
  /** Seeds 7..10 of a conference, in that order. */
  seeds: [T, T, T, T];
  games: SeriesGame<T>[];
  seventh: T | null;
  eighth: T | null;
}

/**
 * NBA play-in: 7v8 (winner is the 7th seed), 9v10 (loser is out), then the 7v8 loser hosts
 * the 9v10 winner for the 8th seed. `play(home, away)` returns [homeScore, awayScore].
 */
export function playIn<T>(seeds: [T, T, T, T], play: (home: T, away: T, game: number) => [number, number]): PlayIn<T> {
  const games: SeriesGame<T>[] = [];
  const game = (home: T, away: T): [T, T] => {
    let [h, w] = play(home, away, games.length);
    if (h === w) h++;
    games.push({ home, away, homeScore: h, awayScore: w });
    return h > w ? [home, away] : [away, home];
  };
  const [s7, s8, s9, s10] = seeds;
  const [seventh, lost78] = game(s7, s8);
  const [won910] = game(s9, s10);
  const [eighth] = game(lost78, won910);
  return { seeds, games, seventh, eighth };
}
