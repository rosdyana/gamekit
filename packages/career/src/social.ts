// Fame, image and followers: the public side of a career.
import type { Rand } from "./money.js";

export interface Public {
  /** 0..100 */
  fame: number;
  /** -100 (villain) .. 100 (role model) */
  image: number;
  followers: number;
}

/** Followers a player of this fame settles towards. */
export const followersFor = (fame: number) => Math.round(Math.pow(fame, 2.6) * 60 + fame * 500 + 120);

export interface SocialOptions {
  /** Share of the gap to the target closed per week. */
  pull?: number;
  /** Controversy sells: followers multiplier when image is below -30. */
  notoriety?: number;
  /** Weekly fame fade: a flat amount plus a share of fame. */
  fade?: [number, number];
}

/** One week: followers drift towards their target, fame fades unless it is fed. */
export function socialWeek(p: Public, o: SocialOptions = {}) {
  const target = followersFor(p.fame) * (p.image < -30 ? (o.notoriety ?? 1.25) : 1);
  p.followers = Math.round(p.followers + (target - p.followers) * (o.pull ?? 0.08));
  const [flat, share] = o.fade ?? [0.03, 0.004];
  p.fame = Math.max(0, Math.min(100, p.fame - flat - p.fame * share));
}

/**
 * A moment going viral (poster dunk, buzzer-beater, a mixtape). `size` 0..1 is how
 * spectacular it was; small accounts grow fastest in relative terms. Returns the gain.
 */
export function viral(p: Public, r: Rand, size: number): number {
  const base = 400 + Math.sqrt(p.followers) * 120;
  const gain = Math.round(base * size * (0.5 + r()) * (1 + size * 3));
  p.followers += gain;
  p.fame = Math.min(100, p.fame + size * 2);
  return gain;
}

/** Label for follower counts: 950, 12.4K, 3.1M. */
export function followerLabel(n: number): string {
  if (n >= 1e6) return `${Number((n / 1e6).toPrecision(3))}M`;
  if (n >= 1e4) return `${Number((n / 1e3).toPrecision(3))}K`;
  return Math.round(n).toLocaleString("en-US");
}
