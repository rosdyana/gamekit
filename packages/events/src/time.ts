/**
 * Turn-based calendar: one turn = one week (or any unit). Turn 0 is the first
 * week of `startYear`.
 */
export interface Calendar {
  perYear: number;
  startYear: number;
}

export const calendar = (startYear: number, perYear = 52): Calendar => ({ startYear, perYear });

export const yearOf = (c: Calendar, turn: number) => c.startYear + Math.floor(turn / c.perYear);

/** 1-based week (or turn) inside the year. */
export const weekOfYear = (c: Calendar, turn: number) => (((turn % c.perYear) + c.perYear) % c.perYear) + 1;

export const turnOf = (c: Calendar, year: number, week: number) => (year - c.startYear) * c.perYear + (week - 1);

/** Whole years between a birth turn and now. */
export const ageAt = (c: Calendar, birthTurn: number, turn: number) => Math.floor((turn - birthTurn) / c.perYear);

/** True on the player's birthday turn (every perYear turns after birth). */
export const isBirthday = (c: Calendar, birthTurn: number, turn: number) => (turn - birthTurn) % c.perYear === 0;

/**
 * Football-style seasons that start mid-year: with `startWeek` 32 (August),
 * turns from August 2026 to July 2027 are season "2026/27".
 */
export function seasonOf(c: Calendar, turn: number, startWeek: number): { start: number; label: string } {
  const y = yearOf(c, turn);
  const start = weekOfYear(c, turn) >= startWeek ? y : y - 1;
  return { start, label: `${start}/${String((start + 1) % 100).padStart(2, "0")}` };
}

/**
 * Piecewise-linear curve through (x, y) points, clamped at both ends. Good for
 * aging (growth by age), fatigue penalties, price scaling…
 */
export function curve(points: readonly (readonly [number, number])[]): (x: number) => number {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      if (x <= x1) {
        const [x0, y0] = pts[i - 1];
        return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      }
    }
    return pts[pts.length - 1][1];
  };
}

/** Keep a value inside [lo, hi]. */
export const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** Move `v` a fraction of the way toward `target` (mood drift, form…). */
export const drift = (v: number, target: number, rate: number) => v + (target - v) * rate;

/** Capped news/log list: newest first. */
export function pushLog<T>(list: T[], item: T, max = 80): T[] {
  list.unshift(item);
  if (list.length > max) list.length = max;
  return list;
}
