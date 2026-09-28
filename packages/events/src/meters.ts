/** Named 0..100 gauges (relationships, moods…) as plain data. */
export type Meters<K extends string> = Record<K, number>;

/** Add `delta` to one meter, clamped to [lo, hi]. Returns the new value. */
export function nudge<K extends string>(m: Meters<K>, key: K, delta: number, lo = 0, hi = 100): number {
  const v = Math.max(lo, Math.min(hi, (m[key] ?? 0) + delta));
  m[key] = v;
  return v;
}

/** Drift every listed meter toward its target by `rate` (0..1) — e.g. relationships cooling back to neutral. */
export function settle<K extends string>(m: Meters<K>, targets: Partial<Record<K, number>>, rate: number): void {
  for (const key of Object.keys(targets) as K[]) {
    const target = targets[key];
    if (target === undefined) continue;
    const v = m[key] ?? target;
    m[key] = v + (target - v) * rate;
  }
}

/** Label for a value by ascending thresholds: band(72, [[0,"Hostile"],[30,"Cold"],[55,"Warm"],[80,"Close"]]) === "Warm". */
export function band<L>(v: number, bands: readonly (readonly [number, L])[]): L {
  if (bands.length === 0) throw new Error("band() needs at least one threshold");
  // Below the first threshold still gets the lowest label.
  let label = bands[0][1];
  for (const [at, l] of bands) if (v >= at) label = l;
  return label;
}
