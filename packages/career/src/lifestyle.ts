// Things money buys: lifestyle tiers with weekly costs, and owned ladders (houses, cars).
import type { Wallet } from "./money.js";

export interface Lifestyle {
  label: string;
  weekly: number;
  /** Weekly morale and fame effects, if the game uses them. */
  morale?: number;
  fame?: number;
}

export interface Tier {
  label: string;
  price: number;
}

/** Moving up a lifestyle tier needs `weeks` of its cost in the bank. */
export function lifestyleBlocked(money: number, tiers: readonly Lifestyle[], current: number, next: number, weeks = 8): string | null {
  if (next < 0 || next >= tiers.length) return "Unknown lifestyle";
  if (next > current && money < tiers[next].weekly * weeks) return `You can't afford ${weeks} weeks of that.`;
  return null;
}

/**
 * Buy rung `tier` of an owned ladder (index 0 is usually "nothing yet"). Only upgrades.
 * Returns an error message, or null after paying.
 */
export function buyTier(w: Wallet, owned: number, tiers: readonly Tier[], tier: number): string | null {
  const t = tiers[tier];
  if (!t || tier <= owned) return "Already have something better";
  if (w.money < t.price) return "Not enough money";
  w.money -= t.price;
  return null;
}

/** Which rung of `thresholds` (ascending) a value has reached: 0 = none, 1 = first... */
export function tierOf(value: number, thresholds: readonly number[]): number {
  let t = 0;
  for (const x of thresholds) if (value >= x) t++;
  return t;
}

/** Progress 0..1 from the current rung towards the next (1 once the top is reached). */
export function tierProgress(value: number, thresholds: readonly number[]): number {
  const t = tierOf(value, thresholds);
  if (t >= thresholds.length) return 1;
  const lo = t ? thresholds[t - 1] : 0;
  return Math.max(0, Math.min(1, (value - lo) / (thresholds[t] - lo)));
}
