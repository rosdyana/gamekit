import { describe, expect, it } from "vitest";
import { swissDraw, type Fixture } from "../src/index.js";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NATIONS = ["ENG", "ESP", "GER", "ITA", "FRA", "POR", "NED", "BEL", "SCO", "AUT", "SUI", "CZE", "CRO", "SRB", "UKR", "TUR", "GRE", "DEN"];

/** Teams "NAT-pot-i"; with `pairs`, two teams of each nation share a pot. */
function makePots(potCount: number, size: number, pairs = false): string[][] {
  return Array.from({ length: potCount }, (_, p) =>
    Array.from({ length: size }, (_, i) => `${NATIONS[((pairs ? Math.floor(i / 2) : i) + p * 5) % NATIONS.length]}-${p}-${i}`),
  );
}

const nation = (t: string) => t.slice(0, 3);
const potOf = (t: string) => Number(t.split("-")[1]);

/** Checks every rule of the league phase; returns the flat fixtures. */
function verify(pots: string[][], days: Fixture<string>[][], perPot: number, conflict?: (a: string, b: string) => boolean) {
  const teams = pots.flat();
  expect(days).toHaveLength(perPot * pots.length);
  for (const day of days) {
    expect(day).toHaveLength(teams.length / 2);
    const seen = day.flatMap((f) => [f.home, f.away]);
    expect(new Set(seen).size).toBe(teams.length);
  }
  const all = days.flat();
  const keys = all.map((f) => [f.home, f.away].sort().join("|"));
  expect(new Set(keys).size).toBe(all.length);
  for (const f of all) {
    expect(f.home).not.toBe(f.away);
    if (conflict) expect(conflict(f.home, f.away)).toBe(false);
  }
  for (const t of teams) {
    for (let p = 0; p < pots.length; p++) {
      const vs = all.filter((f) => (f.home === t && potOf(f.away) === p) || (f.away === t && potOf(f.home) === p));
      expect(vs).toHaveLength(perPot);
      const home = vs.filter((f) => f.home === t).length;
      if (perPot % 2 === 0) expect(home).toBe(perPot / 2);
      else expect(Math.abs(home - perPot / 2)).toBeLessThanOrEqual(0.5);
    }
  }
  return all;
}

describe("swissDraw", () => {
  it("draws the 36-team Champions League league phase (4 pots of 9, 8 matchdays)", () => {
    const pots = makePots(4, 9);
    const days = swissDraw(pots, mulberry32(1));
    expect(days).toHaveLength(8);
    expect(days.every((d) => d.length === 18)).toBe(true);
    verify(pots, days, 2);
  });

  it("respects country conflicts with two clubs of a nation in a pot", () => {
    const pots = makePots(4, 9, true);
    const conflict = (a: string, b: string) => nation(a) === nation(b);
    expect(pots.some((p) => p.filter((t) => nation(t) === nation(p[0])).length === 2)).toBe(true);
    for (let s = 0; s < 20; s++) verify(pots, swissDraw(pots, mulberry32(s), { conflict }), 2, conflict);
  });

  it("works for 16 teams in 4 pots of 4 and 18 teams in 3 pots of 6", () => {
    for (let s = 0; s < 20; s++) {
      const a = makePots(4, 4);
      verify(a, swissDraw(a, mulberry32(s)), 2);
      const b = makePots(3, 6);
      const days = swissDraw(b, mulberry32(s));
      expect(days).toHaveLength(6);
      expect(days.every((d) => d.length === 9)).toBe(true);
      verify(b, days, 2);
    }
  });

  it("supports other perPot values", () => {
    const four = makePots(4, 9);
    verify(four, swissDraw(four, mulberry32(3), { perPot: 4 }), 4);
    const one = makePots(4, 4);
    verify(one, swissDraw(one, mulberry32(3), { perPot: 1 }), 1);
    const three = makePots(2, 6);
    verify(three, swissDraw(three, mulberry32(3), { perPot: 3 }), 3);
  });

  it("is deterministic for a seed and varies between seeds", () => {
    const pots = makePots(4, 9);
    expect(swissDraw(pots, mulberry32(42))).toEqual(swissDraw(pots, mulberry32(42)));
    expect(swissDraw(pots, mulberry32(42))).not.toEqual(swissDraw(pots, mulberry32(43)));
  });

  it("is fast enough to draw every season", () => {
    const pots = makePots(4, 9, true);
    const conflict = (a: string, b: string) => nation(a) === nation(b);
    const t0 = performance.now();
    for (let s = 0; s < 20; s++) swissDraw(pots, mulberry32(s), { conflict });
    expect((performance.now() - t0) / 20).toBeLessThan(50);
  });

  it("throws on impossible input", () => {
    expect(() => swissDraw([["a", "b"], ["c"]], mulberry32(1))).toThrow(/same number/);
    expect(() => swissDraw(makePots(4, 2), mulberry32(1))).toThrow(/own pot/);
    expect(() => swissDraw(makePots(3, 3), mulberry32(1))).toThrow(/even/);
    expect(() => swissDraw([], mulberry32(1))).toThrow();
    // Everyone conflicts with everyone.
    expect(() => swissDraw(makePots(4, 4), mulberry32(1), { conflict: () => true, attempts: 5 })).toThrow(/No valid/);
  });
});
