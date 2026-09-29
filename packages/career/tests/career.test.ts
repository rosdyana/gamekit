import { describe, expect, it } from "vitest";
import {
  acceptSponsor,
  blankPortfolio,
  buyProperty,
  buyTier,
  cancelSponsor,
  convert,
  deposit,
  followersFor,
  lifestyleBlocked,
  marketWeek,
  netWorth,
  openBusiness,
  progressiveTax,
  recordWorth,
  roundMoney,
  sellBusiness,
  sellProperty,
  shortMoney,
  socialWeek,
  splitTax,
  sponsorExitFee,
  sponsorKind,
  sponsorPay,
  sponsorUpkeep,
  tierOf,
  tierProgress,
  viral,
  withdraw,
  type BusinessDef,
  type Sponsor,
} from "../src/index.js";

const seeded = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const BIZ: Record<"stall" | "label", BusinessDef> = {
  stall: { label: "Food stall", cost: 20_000, yield: 0.1, risk: 0.03 },
  label: { label: "Fashion label", cost: 8_000_000, yield: 0.13, risk: 0.5, fameLinked: true },
};

describe("money", () => {
  it("rounds and formats", () => {
    expect(roundMoney(944)).toBe(940);
    expect(roundMoney(12_345)).toBe(12_300);
    expect(roundMoney(1_234_567)).toBe(1_235_000);
    expect(shortMoney(950)).toBe("$950");
    expect(shortMoney(12_500)).toBe("$12.5K");
    expect(shortMoney(-3_200_000)).toBe("-$3.2M");
  });

  it("converts and taxes", () => {
    expect(convert(100, "USD", "IDR", { USD: 1, IDR: 16_000 })).toBe(1_600_000);
    expect(() => convert(1, "USD", "XXX", { USD: 1 })).toThrow();
    const brackets = [
      [0, 0],
      [10_000, 0.1],
      [50_000, 0.3],
    ] as const;
    expect(progressiveTax(5_000, brackets)).toBe(0);
    expect(progressiveTax(60_000, brackets)).toBeCloseTo(4_000 + 3_000);
    expect(
      splitTax(1_000, [
        { share: 1, rate: 0 },
        { share: 1, rate: 0.1 },
      ]),
    ).toBeCloseTo(50);
  });
});

describe("portfolio", () => {
  it("moves cash in and out", () => {
    const w = { money: 1_000 };
    const p = blankPortfolio();
    expect(deposit(w, p, "index", 5_000)).toBe("Not enough cash.");
    expect(deposit(w, p, "index", 600.7)).toBeNull();
    expect([w.money, p.index]).toEqual([400, 600]);
    expect(withdraw(w, p, "index", 1e9)).toBeNull();
    expect([w.money, p.index]).toEqual([1_000, 0]);
    expect(withdraw(w, p, "crypto", 10)).toBe("Nothing to withdraw.");
  });

  it("buys and sells property and businesses", () => {
    const w = { money: 1_000_000 };
    const p = blankPortfolio<"stall" | "label">();
    expect(buyProperty(w, p, 250_000, 2)).toBeNull();
    expect(sellProperty(w, p, 300_000)).toBeNull();
    expect(w.money).toBe(1_000_000 - 500_000 + 285_000);
    let made = 0;
    const make = () => ({ id: `b${++made}`, name: "Stall" });
    expect(openBusiness(w, p, "label", 8_000_000, make)).toBe("Not enough cash.");
    expect(made).toBe(0);
    const b = openBusiness(w, p, "stall", 20_000, make);
    expect(typeof b).toBe("object");
    expect(openBusiness(w, p, "stall", 20_000, make, 1)).toMatch(/plenty/);
    expect(netWorth(w.money, p)).toBe(w.money + p.propertyPrice + 20_000);
    const sold = sellBusiness(w, p, "b1");
    expect(typeof sold === "object" && !sold.open).toBe(true);
  });

  it("is deterministic and reports events", () => {
    const run = () => {
      const p = blankPortfolio<"stall" | "label">();
      p.index = 100_000;
      p.crypto = 50_000;
      p.property = 1;
      p.businesses.push({ id: "x", kind: "label", name: "L", value: 1e6, invested: 1e6, open: true });
      const r = seeded(7);
      const types: string[] = [];
      let income = 0;
      for (let wk = 0; wk < 520; wk++) {
        const res = marketWeek(p, r, { businesses: BIZ, fame: 80 });
        income += res.income;
        types.push(...res.events.map((e) => e.type));
        recordWorth(p, wk, netWorth(0, p));
      }
      return { p, types, income };
    };
    const a = run();
    const b = run();
    expect(a).toEqual(b);
    expect(a.income).toBeGreaterThan(0);
    expect(a.types.length).toBeGreaterThan(0);
    expect(a.p.history.length).toBe(130);
    expect(a.p.propertyPrice).toBeGreaterThanOrEqual(80_000);
  });

  it("matches gamekit-rng draw order (three uniforms per gauss)", () => {
    const p = blankPortfolio();
    let draws = 0;
    const r = () => (draws++, 0.5);
    marketWeek(p, r, { businesses: {} });
    // index gauss + property gauss; crypto is empty and draws nothing.
    expect(draws).toBe(6);
  });
});

describe("sponsors", () => {
  const offer = (id: string, kind: Sponsor["kind"]): Sponsor => ({
    id,
    brand: id,
    kind,
    weekly: 100,
    bonus: 10,
    until: 100,
    minImage: -10,
    maxImage: 100,
    expires: 5,
  });

  it("picks kinds and pay by fame and image", () => {
    const r = seeded(1);
    expect(sponsorKind(r, 5, 0)).toBe("local");
    const kinds = Array.from({ length: 200 }, () => sponsorKind(r, 60, -50));
    expect(kinds.filter((k) => k === "edgy").length).toBeGreaterThan(100);
    expect(sponsorPay("clean", 80)).toBeGreaterThan(sponsorPay("clean", 40));
    expect(sponsorPay("edgy", 50)).toBeGreaterThan(sponsorPay("clean", 50));
    expect(sponsorPay("local", 10) % 10).toBe(0);
  });

  it("accepts with a per-kind cap, buys out, and enforces clauses", () => {
    const book = { sponsors: [] as Sponsor[], sponsorOffers: ["a", "b", "c", "d"].map((x) => offer(x, "clean")) };
    for (const id of ["a", "b", "c"]) expect(typeof acceptSponsor(book, id)).toBe("object");
    expect(acceptSponsor(book, "d")).toMatch(/limit/);
    expect(book.sponsors[0].expires).toBeUndefined();
    expect(sponsorExitFee(book.sponsors[0], 90)).toBe(1_200);
    const w = { money: 100 };
    expect(cancelSponsor(w, book, "a", 90)).toMatch(/buy out/);
    w.money = 5_000;
    expect(typeof cancelSponsor(w, book, "a", 90)).toBe("object");
    expect(w.money).toBe(3_800);
    book.sponsors[0].until = 10;
    const gone = sponsorUpkeep(book, 10, -50);
    expect(gone.map((g) => g.why)).toEqual(["ended", "image"]);
    expect(book.sponsors).toEqual([]);
    expect(book.sponsorOffers).toEqual([]);
  });
});

describe("social", () => {
  it("drifts followers and fades fame", () => {
    const p = { fame: 50, image: 0, followers: 0 };
    for (let i = 0; i < 200; i++) socialWeek(p, { fade: [0, 0] });
    expect(p.followers).toBeGreaterThan(followersFor(50) * 0.99);
    socialWeek(p);
    expect(p.fame).toBeLessThan(50);
    const gain = viral(p, seeded(3), 1);
    expect(gain).toBeGreaterThan(0);
  });
});

describe("lifestyle and tiers", () => {
  it("guards upgrades", () => {
    const tiers = [
      { label: "Home", weekly: 0 },
      { label: "Flat", weekly: 500 },
    ];
    expect(lifestyleBlocked(1_000, tiers, 0, 1)).toMatch(/8 weeks/);
    expect(lifestyleBlocked(4_000, tiers, 0, 1)).toBeNull();
    expect(lifestyleBlocked(0, tiers, 1, 0)).toBeNull();
    const houses = [
      { label: "None", price: 0 },
      { label: "Hut", price: 100 },
    ];
    const w = { money: 150 };
    expect(buyTier(w, 0, houses, 1)).toBeNull();
    expect(buyTier(w, 1, houses, 1)).toMatch(/better/);
    expect(tierOf(25, [10, 20, 30])).toBe(2);
    expect(tierProgress(25, [10, 20, 30])).toBeCloseTo(0.5);
    expect(tierProgress(40, [10, 20, 30])).toBe(1);
  });
});
