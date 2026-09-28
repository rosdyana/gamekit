/**
 * Promotion and relegation between tiers. `tiers[i]` is tier i's final order (best first).
 * `moves` is how many teams swap across each boundary (a number for every boundary, or one per boundary:
 * moves[i] = teams relegated from tier i and promoted from tier i+1). Returns the new membership of every
 * tier: survivors keep their finishing order, then the arrivals (promoted teams first, in their order; relegated teams after survivors).
 *
 * So a middle tier becomes [survivors…, promoted from below…, relegated from above…]. Tier sizes never change.
 * Throws if a move count is negative or larger than a tier it touches, if one tier would send more teams
 * up and down than it has, or if `moves` has the wrong length.
 */
export function promoteRelegate<T>(tiers: readonly (readonly T[])[], moves: number | readonly number[]): T[][] {
  const bounds = Math.max(0, tiers.length - 1);
  const m = typeof moves === "number" ? Array.from({ length: bounds }, () => moves) : [...moves];
  if (m.length !== bounds) throw new Error(`Expected ${bounds} move counts, got ${m.length}`);
  m.forEach((n, i) => {
    if (!Number.isInteger(n) || n < 0) throw new Error(`Move count ${n} is not a whole number >= 0`);
    if (n > tiers[i].length || n > tiers[i + 1].length) throw new Error(`Move count ${n} exceeds a tier size`);
  });
  return tiers.map((tier, i) => {
    const up = i > 0 ? m[i - 1] : 0; // top teams leaving upward
    const down = i < bounds ? m[i] : 0; // bottom teams leaving downward
    if (up + down > tier.length) throw new Error(`Tier ${i} cannot lose ${up + down} of ${tier.length} teams`);
    const survivors = tier.slice(up, tier.length - down);
    const promoted = i < bounds ? tiers[i + 1].slice(0, down) : [];
    const relegated = i > 0 ? tiers[i - 1].slice(tiers[i - 1].length - up) : [];
    return [...survivors, ...promoted, ...relegated];
  });
}

/** Split a final order into named slots in sequence: allocate(order, [{ key: "cl", count: 4 }, { key: "el", count: 2 }]). Missing teams give shorter lists; leftovers are ignored. */
export function allocate<T, K extends string>(order: readonly T[], slots: readonly { key: K; count: number }[]): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  let at = 0;
  for (const { key, count } of slots) {
    const n = Math.max(0, Math.floor(count));
    // A repeated key keeps collecting (e.g. two "el" slots around a cup winner).
    out[key] = [...(out[key] ?? []), ...order.slice(at, at + n)];
    at += n;
  }
  return out;
}
