/**
 * Rolling ranking ledger (tennis/badminton/golf style, or a club coefficient):
 * points earned at a time `t`, counted inside a window, best-N results only.
 */
export interface LedgerEntry {
  id: string;
  /** Any monotonic time unit (week number, day, season). */
  t: number;
  pts: number;
}

export interface RankingOptions {
  /** Entries with `now - t >= window` no longer count. */
  window: number;
  /** Count only the best N results per id (default: all). */
  best?: number;
  /** Restrict to these ids (e.g. active players). */
  include?: (id: string) => boolean;
}

export interface Ranking {
  /** Ids, best first (only ids with points > 0). */
  order: string[];
  points: Map<string, number>;
  rankOf(id: string): number | null;
}

export function rank(entries: readonly LedgerEntry[], now: number, o: RankingOptions): Ranking {
  const byId = new Map<string, number[]>();
  for (const e of entries) {
    if (now - e.t >= o.window || e.t > now) continue;
    if (o.include && !o.include(e.id)) continue;
    const list = byId.get(e.id) ?? [];
    list.push(e.pts);
    byId.set(e.id, list);
  }
  const points = new Map<string, number>();
  for (const [id, list] of byId) {
    const counted = o.best ? list.sort((a, b) => b - a).slice(0, o.best) : list;
    points.set(id, counted.reduce((a, b) => a + b, 0));
  }
  const order = [...points.entries()]
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
  const index = new Map(order.map((id, i) => [id, i + 1]));
  return { order, points, rankOf: (id) => index.get(id) ?? null };
}

/** Drop entries that can never count again (keeps saves small). */
export const prune = (entries: LedgerEntry[], now: number, window: number) =>
  entries.filter((e) => now - e.t < window);

/** Memoise `rank` on a caller-supplied key (e.g. `${week}:${entries.length}`). */
export function memoRanking(compute: () => Ranking) {
  let lastKey: string | null = null;
  let last: Ranking | null = null;
  return (key: string): Ranking => {
    if (key !== lastKey || !last) {
      last = compute();
      lastKey = key;
    }
    return last;
  };
}

/** Share of winner points/prize by round reached. */
export type RoundShares = Record<string, { points: number; prize: number }>;

export const TOUR_SHARES: RoundShares = {
  W: { points: 1, prize: 1 },
  F: { points: 0.85, prize: 0.5 },
  SF: { points: 0.7, prize: 0.25 },
  QF: { points: 0.55, prize: 0.12 },
  R16: { points: 0.4, prize: 0.08 },
  R32: { points: 0.25, prize: 0.05 },
  R64: { points: 0.12, prize: 0.03 },
};
