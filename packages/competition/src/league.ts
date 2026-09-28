import { shuffle, type Rand } from "./util.js";

export interface Fixture<T> {
  home: T;
  away: T;
}

/**
 * Round-robin schedule by the circle method: every team plays every other
 * once per cycle, alternating home and away. `double` adds the return legs
 * (second half mirrors the first). Odd team counts get a rest each matchday.
 */
export function roundRobin<T>(teams: readonly T[], o: { double?: boolean; rand?: Rand } = {}): Fixture<T>[][] {
  const list: (T | null)[] = o.rand ? shuffle(o.rand, teams) : [...teams];
  if (list.length % 2) list.push(null);
  const n = list.length;
  const days: Fixture<T>[][] = [];
  const rot = [...list];
  for (let d = 0; d < n - 1; d++) {
    const day: Fixture<T>[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = rot[i];
      const b = rot[n - 1 - i];
      if (a === null || b === null) continue;
      // Alternate who hosts so nobody plays five home games in a row.
      const flip = (d + i) % 2 === 1 || (i === 0 && d % 2 === 1);
      day.push(flip ? { home: b, away: a } : { home: a, away: b });
    }
    days.push(day);
    rot.splice(1, 0, rot.pop()!);
  }
  if (o.double) for (const day of [...days]) days.push(day.map((f) => ({ home: f.away, away: f.home })));
  return days;
}

export interface Result<T> {
  home: T;
  away: T;
  homeScore: number;
  awayScore: number;
}

export interface PointsRule {
  win: number;
  draw: number;
  loss: number;
}

export const FOOTBALL_POINTS: PointsRule = { win: 3, draw: 1, loss: 0 };

export interface Row<T> {
  team: T;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  for: number;
  against: number;
  points: number;
  /** Latest first, e.g. ["W", "D", "L"]. */
  form: ("W" | "D" | "L")[];
}

/** League table as plain data: `Map`-free so it serialises straight into saves. */
export interface Table<T> {
  rows: Row<T>[];
  results: Result<T>[];
  rule: PointsRule;
}

export function table<T>(teams: readonly T[], rule: PointsRule = FOOTBALL_POINTS): Table<T> {
  return {
    rule,
    results: [],
    rows: teams.map((team) => ({ team, played: 0, won: 0, drawn: 0, lost: 0, for: 0, against: 0, points: 0, form: [] })),
  };
}

export function record<T>(t: Table<T>, r: Result<T>) {
  const home = t.rows.find((x) => x.team === r.home);
  const away = t.rows.find((x) => x.team === r.away);
  if (!home || !away) throw new Error("Team not in table");
  t.results.push(r);
  const apply = (row: Row<T>, gf: number, ga: number) => {
    row.played++;
    row.for += gf;
    row.against += ga;
    const res: "W" | "D" | "L" = gf > ga ? "W" : gf < ga ? "L" : "D";
    if (res === "W") row.won++;
    else if (res === "L") row.lost++;
    else row.drawn++;
    row.points += res === "W" ? t.rule.win : res === "L" ? t.rule.loss : t.rule.draw;
    row.form = [res, ...row.form].slice(0, 5);
  };
  apply(home, r.homeScore, r.awayScore);
  apply(away, r.awayScore, r.homeScore);
}

export type Tiebreak = "points" | "goalDifference" | "goalsFor" | "wins" | "headToHead";

/** Premier-League style by default; UEFA uses headToHead before goalDifference. */
export const DEFAULT_TIEBREAKS: Tiebreak[] = ["points", "goalDifference", "goalsFor", "headToHead"];

function h2hPoints<T>(t: Table<T>, team: T, group: Set<T>): number[] {
  let pts = 0;
  let gd = 0;
  for (const r of t.results) {
    if (!group.has(r.home) || !group.has(r.away)) continue;
    if (r.home === team || r.away === team) {
      const mine = r.home === team ? r.homeScore : r.awayScore;
      const theirs = r.home === team ? r.awayScore : r.homeScore;
      pts += mine > theirs ? t.rule.win : mine < theirs ? t.rule.loss : t.rule.draw;
      gd += mine - theirs;
    }
  }
  return [pts, gd];
}

/** Sorted rows. Ties that survive every rule keep the original team order. */
export function standings<T>(t: Table<T>, tiebreaks: Tiebreak[] = DEFAULT_TIEBREAKS): Row<T>[] {
  const order = new Map(t.rows.map((r, i) => [r.team, i]));
  const key = (r: Row<T>, rule: Tiebreak): number =>
    rule === "points" ? r.points : rule === "goalDifference" ? r.for - r.against : rule === "goalsFor" ? r.for : rule === "wins" ? r.won : 0;
  const rows = [...t.rows];
  rows.sort((a, b) => {
    for (const rule of tiebreaks) {
      if (rule === "headToHead") {
        // Mini-league among every team level on points with these two.
        const level = new Set(t.rows.filter((r) => r.points === a.points).map((r) => r.team));
        if (!level.has(b.team)) continue;
        const [pa, ga] = h2hPoints(t, a.team, level);
        const [pb, gb] = h2hPoints(t, b.team, level);
        if (pa !== pb) return pb - pa;
        if (ga !== gb) return gb - ga;
        continue;
      }
      const d = key(b, rule) - key(a, rule);
      if (d !== 0) return d;
    }
    return order.get(a.team)! - order.get(b.team)!;
  });
  return rows;
}
