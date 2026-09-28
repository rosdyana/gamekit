/** Any () => number in [0, 1); pass a seeded one for reproducible draws. */
export type Rand = () => number;

export function shuffle<T>(rand: Rand, xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
