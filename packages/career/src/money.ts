/** Any () => number in [0, 1); pass a seeded one for reproducible careers. */
export type Rand = () => number;

/** Cash on hand. Career states usually embed this field. */
export interface Wallet {
  money: number;
}

/** Round to a "price-like" value: tens under 1k, hundreds under 100k, thousands above. */
export function roundMoney(v: number): number {
  if (v < 1000) return Math.round(v / 10) * 10;
  if (v < 100_000) return Math.round(v / 100) * 100;
  return Math.round(v / 1000) * 1000;
}

/** Compact label: $950, $12.5K, $3.2M, $1.05B. */
export function shortMoney(v: number, symbol = "$"): string {
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  const fmt = (x: number, unit: string) => `${sign}${symbol}${Number(x.toPrecision(3))}${unit}`;
  if (a >= 1e9) return fmt(a / 1e9, "B");
  if (a >= 1e6) return fmt(a / 1e6, "M");
  if (a >= 1e4) return fmt(a / 1e3, "K");
  return `${sign}${symbol}${Math.round(a).toLocaleString("en-US")}`;
}

/** Spend if affordable. Returns an error message, or null on success. */
export function spend(w: Wallet, amount: number, why = "Not enough money"): string | null {
  if (w.money < amount) return why;
  w.money -= amount;
  return null;
}

/** Convert between currencies given units-per-dollar rates (e.g. { USD: 1, IDR: 16000 }). */
export function convert(amount: number, from: string, to: string, perDollar: Readonly<Record<string, number>>): number {
  const a = perDollar[from];
  const b = perDollar[to];
  if (!a || !b) throw new Error(`Unknown currency ${!a ? from : to}`);
  return (amount / a) * b;
}

/** Tiered progressive tax: brackets are [threshold, rate] sorted by threshold. */
export function progressiveTax(income: number, brackets: readonly (readonly [number, number])[]): number {
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const [lo, rate] = brackets[i];
    const hi = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity;
    if (income <= lo) break;
    tax += (Math.min(income, hi) - lo) * rate;
  }
  return tax;
}

/**
 * Split a salary across the places it was earned (athletes' "jock tax"): each entry is
 * a share of working days and that place's flat rate. Shares are normalised.
 */
export function splitTax(income: number, places: readonly { share: number; rate: number }[]): number {
  const total = places.reduce((a, p) => a + Math.max(0, p.share), 0);
  if (!total) return 0;
  return places.reduce((a, p) => a + (income * Math.max(0, p.share) * p.rate) / total, 0);
}
