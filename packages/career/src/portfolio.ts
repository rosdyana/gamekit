// Where an athlete's money goes once the house is bought: savings, markets, rental
// property and businesses. Plain data, weekly ticks, seeded randomness.
import { type Rand, type Wallet } from "./money.js";

export interface BusinessDef {
  label: string;
  /** Default cost to start one. */
  cost: number;
  /** Yearly yield on the business value. */
  yield: number;
  /** Yearly chance of trouble (half a slump, half going bust); booms at half this rate. */
  risk: number;
  text?: string;
  /** Income scales with the owner's fame (fashion labels, restaurants). */
  fameLinked?: boolean;
}

export interface Business<K extends string = string> {
  id: string;
  kind: K;
  name: string;
  /** What the business is worth now. */
  value: number;
  /** Total money put in. */
  invested: number;
  open: boolean;
}

export interface Portfolio<K extends string = string> {
  savings: number;
  index: number;
  crypto: number;
  /** Rental property units and the current price of one. */
  property: number;
  propertyPrice: number;
  businesses: Business<K>[];
  /** Net worth snapshots, newest first. */
  history: { week: number; worth: number }[];
  /** Investment income since the game last reset it (e.g. per season). */
  income: number;
}

export const blankPortfolio = <K extends string = string>(propertyPrice = 250_000): Portfolio<K> => ({
  savings: 0,
  index: 0,
  crypto: 0,
  property: 0,
  propertyPrice,
  businesses: [],
  history: [],
  income: 0,
});

export const LIQUID_ASSETS = ["savings", "index", "crypto"] as const;
export type Liquid = (typeof LIQUID_ASSETS)[number];

export const ASSET_LABEL: Record<Liquid, string> = {
  savings: "Savings account",
  index: "Index fund",
  crypto: "Crypto",
};

/** Yearly rates. Volatilities are yearly standard deviations. */
export interface MarketRates {
  savings: number;
  indexDrift: number;
  indexVol: number;
  cryptoDrift: number;
  cryptoVol: number;
  /** Weekly chances of a crypto crash (x0.45) or moon (x1.9). */
  crash: number;
  moon: number;
  propertyGrowth: number;
  /** Weekly standard deviation of the property price. */
  propertyVol: number;
  propertyFloor: number;
  rentYield: number;
}

export const DEFAULT_RATES: MarketRates = {
  savings: 0.025,
  indexDrift: 0.07,
  indexVol: 0.16,
  cryptoDrift: 0.15,
  cryptoVol: 0.85,
  crash: 0.006,
  moon: 0.004,
  propertyGrowth: 0.03,
  propertyVol: 0.01,
  propertyFloor: 80_000,
  rentYield: 0.05,
};

// Same noise as gamekit-rng's gauss (sum of three uniforms), so results match it draw for draw.
const gauss = (r: Rand, sd: number) => (r() + r() + r() - 1.5) * 2 * sd;
const chance = (r: Rand, p: number) => r() < p;

// ---------------------------------------------------------------- actions

export function deposit(w: Wallet, p: Portfolio, asset: Liquid, amount: number): string | null {
  amount = Math.floor(amount);
  if (amount <= 0) return "Nothing to invest.";
  if (w.money < amount) return "Not enough cash.";
  w.money -= amount;
  p[asset] += amount;
  return null;
}

export function withdraw(w: Wallet, p: Portfolio, asset: Liquid, amount: number): string | null {
  const have = p[asset];
  if (have < 1) return "Nothing to withdraw.";
  // "All" takes every last cent, not just whole dollars.
  const take = amount >= have - 1 ? have : Math.floor(amount);
  if (take <= 0) return "Nothing to withdraw.";
  p[asset] -= take;
  w.money += take;
  return null;
}

/** `price` is the price of one unit as the game shows it (it may scale propertyPrice). */
export function buyProperty(w: Wallet, p: Portfolio, price: number, units = 1): string | null {
  const cost = price * units;
  if (w.money < cost) return "Not enough cash.";
  w.money -= cost;
  p.property += units;
  return null;
}

/** Sells at `keep` of the price (agent fees and taxes). */
export function sellProperty(w: Wallet, p: Portfolio, price: number, units = 1, keep = 0.95): string | null {
  if (p.property < units) return "No property to sell.";
  p.property -= units;
  w.money += Math.round(price * units * keep);
  return null;
}

/**
 * Start a business for `cost`. `make` is only called once the checks pass (so a refused
 * purchase draws no random numbers) and names the new business.
 */
export function openBusiness<K extends string>(
  w: Wallet,
  p: Portfolio<K>,
  kind: K,
  cost: number,
  make: () => { id: string; name: string },
  max = 6,
): Business<K> | string {
  if (w.money < cost) return "Not enough cash.";
  if (p.businesses.filter((b) => b.open).length >= max) return `Your advisers say ${max} businesses is plenty.`;
  w.money -= cost;
  const { id, name } = make();
  const b: Business<K> = { id, kind, name, value: cost, invested: cost, open: true };
  p.businesses.push(b);
  return b;
}

/** Sell at `keep` of its value. Returns the business sold, or an error message. */
export function sellBusiness<K extends string>(w: Wallet, p: Portfolio<K>, id: string, keep = 0.9): Business<K> | string {
  const b = p.businesses.find((x) => x.id === id && x.open);
  if (!b) return "No such business.";
  b.open = false;
  w.money += Math.round(b.value * keep);
  return b;
}

/** Cash plus everything the portfolio holds; `extra` adds game-specific assets. */
export function netWorth(cash: number, p: Portfolio, extra = 0): number {
  return (
    cash +
    p.savings +
    p.index +
    p.crypto +
    p.property * p.propertyPrice +
    p.businesses.filter((b) => b.open).reduce((a, b) => a + b.value, 0) +
    extra
  );
}

/** Keep a net worth snapshot every `every` weeks (newest first, at most `keep`). */
export function recordWorth(p: Portfolio, week: number, worth: number, every = 4, keep = 150) {
  if (week % every !== 0) return;
  p.history.unshift({ week, worth: Math.round(worth) });
  if (p.history.length > keep) p.history.length = keep;
}

// ---------------------------------------------------------------- weekly markets

export type MarketEvent<K extends string = string> =
  | { type: "cryptoCrash" | "cryptoMoon" }
  | { type: "slump" | "bust" | "boom"; business: Business<K> };

export interface MarketWeekOptions<K extends string> {
  businesses: Readonly<Record<K, BusinessDef>>;
  /** Owner fame 0..100 for fame-linked businesses (default 50). */
  fame?: number;
  /** Scales rent (e.g. a poorer economy). */
  scale?: number;
  /** Rounds the rented unit's price before rent is paid (defaults to none). */
  priceOf?: (propertyPrice: number) => number;
  rates?: Partial<MarketRates>;
}

/**
 * One week of returns, rent, business income and the occasional disaster. Mutates the
 * portfolio and returns the income earned (not yet paid into any wallet) plus what happened.
 */
export function marketWeek<K extends string>(
  p: Portfolio<K>,
  r: Rand,
  o: MarketWeekOptions<K>,
): { income: number; events: MarketEvent<K>[] } {
  const k = { ...DEFAULT_RATES, ...o.rates };
  const events: MarketEvent<K>[] = [];
  const fame = o.fame ?? 50;
  const wk = Math.sqrt(52);
  let income = 0;
  p.savings *= 1 + k.savings / 52;
  p.index = Math.max(0, p.index * Math.exp(k.indexDrift / 52 + gauss(r, k.indexVol / wk)));
  if (p.crypto > 0) {
    p.crypto = Math.max(0, p.crypto * Math.exp(k.cryptoDrift / 52 + gauss(r, k.cryptoVol / wk)));
    if (chance(r, k.crash)) {
      p.crypto *= 0.45;
      events.push({ type: "cryptoCrash" });
    } else if (chance(r, k.moon)) {
      p.crypto *= 1.9;
      events.push({ type: "cryptoMoon" });
    }
  }
  p.propertyPrice = Math.max(k.propertyFloor, p.propertyPrice * (1 + k.propertyGrowth / 52 + gauss(r, k.propertyVol)));
  if (p.property) {
    const unit = o.priceOf ? o.priceOf(p.propertyPrice) : p.propertyPrice * (o.scale ?? 1);
    income += p.property * unit * (k.rentYield / 52);
  }
  for (const b of p.businesses) {
    if (!b.open) continue;
    const def = o.businesses[b.kind];
    const fameK = def.fameLinked ? 0.6 + fame / 125 : 1;
    income += Math.max(0, b.value * (def.yield / 52) * fameK * (0.6 + r() * 0.8));
    b.value = Math.max(0, b.value * (1 + gauss(r, 0.02)));
    if (chance(r, def.risk / 52)) {
      if (chance(r, 0.5)) {
        b.value *= 0.55;
        events.push({ type: "slump", business: b });
      } else {
        b.open = false;
        events.push({ type: "bust", business: b });
      }
    } else if (chance(r, def.risk / 104)) {
      b.value *= 1.5;
      events.push({ type: "boom", business: b });
    }
  }
  return { income, events };
}
