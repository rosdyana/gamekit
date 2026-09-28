import { describe, expect, it } from "vitest";
import {
  champion,
  crossOver,
  drawGroups,
  eloUpdate,
  exitRound,
  expected,
  groupStage,
  knockout,
  pairs,
  penalties,
  playOut,
  playRound,
  prune,
  qualifiers,
  rank,
  reached,
  record,
  roundCodes,
  roundLabel,
  roundRobin,
  scoreline,
  seedBracket,
  seedOrder,
  standings,
  table,
  twoLegs,
} from "../src/index.js";

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

describe("knockout", () => {
  it("seeds so top seeds meet last, with byes for the top seeds", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    const slots = seedBracket(["a", "b", "c", "d", "e", "f"], 8);
    expect(slots).toEqual(["a", null, "d", "e", "b", null, "c", "f"]);
  });

  it("plays out, reports exits and labels rounds", () => {
    const ko = knockout(seedBracket(["a", "b", "c", "d", "e", "f", "g", "h"]));
    const strength: Record<string, number> = { a: 8, b: 7, c: 6, d: 5, e: 4, f: 3, g: 2, h: 1 };
    expect(playOut(ko, (x, y) => (strength[x] > strength[y] ? x : y))).toBe("a");
    expect(champion(ko)).toBe("a");
    expect(reached(ko, "a")).toBe("W");
    expect(reached(ko, "b")).toBe("F");
    expect(reached(ko, "h")).toBe("QF");
    expect(exitRound(ko, "zzz")).toBe(-1);
    expect(roundCodes(32)).toEqual(["R32", "R16", "QF", "SF", "F"]);
    expect(roundLabel(16)).toBe("Round of 16");
  });

  it("lets the caller override one match (the human's)", () => {
    const ko = knockout(["me", "x", "y", "z"]);
    const winners = playRound(ko, (a) => a, new Map([[0, "x"]]));
    expect(winners).toEqual(["x", "y"]);
    expect(pairs(ko)).toEqual([["x", "y"]]);
  });
});

describe("league", () => {
  const teams = ["A", "B", "C", "D", "E", "F"];

  it("round robin: everyone meets once per cycle, once per matchday", () => {
    const days = roundRobin(teams, { double: true });
    expect(days).toHaveLength(10);
    const meetings = new Map<string, number>();
    for (const day of days) {
      const seen = new Set<string>();
      for (const f of day) {
        expect(seen.has(f.home) || seen.has(f.away)).toBe(false);
        seen.add(f.home);
        seen.add(f.away);
        const k = [f.home, f.away].sort().join("-");
        meetings.set(k, (meetings.get(k) ?? 0) + 1);
      }
    }
    expect([...meetings.values()].every((n) => n === 2)).toBe(true);
    expect(meetings.size).toBe(15);
    // Home/away balanced over a double round robin.
    for (const t of teams) {
      const home = days.flat().filter((f) => f.home === t).length;
      expect(home).toBe(5);
    }
  });

  it("gives odd team counts a rest day", () => {
    const days = roundRobin(["A", "B", "C", "D", "E"]);
    expect(days).toHaveLength(5);
    expect(days.every((d) => d.length === 2)).toBe(true);
  });

  it("tables apply 3-1-0 and tiebreaks (goal difference, then head-to-head)", () => {
    const t = table(["A", "B", "C"]);
    record(t, { home: "A", away: "B", homeScore: 1, awayScore: 0 });
    record(t, { home: "B", away: "C", homeScore: 3, awayScore: 0 });
    record(t, { home: "C", away: "A", homeScore: 1, awayScore: 0 });
    // All on 3 points; B has the best goal difference.
    expect(standings(t).map((r) => r.team)).toEqual(["B", "A", "C"]);
    const h2hFirst = table(["X", "Y"]);
    record(h2hFirst, { home: "X", away: "Y", homeScore: 2, awayScore: 1 });
    record(h2hFirst, { home: "Y", away: "X", homeScore: 1, awayScore: 0 });
    expect(standings(h2hFirst, ["points", "headToHead"]).map((r) => r.team)).toEqual(["X", "Y"]);
    expect(t.rows.find((r) => r.team === "A")!.form).toEqual(["L", "W"]);
  });
});

describe("groups", () => {
  it("draws pots into groups with no same-nation clashes", () => {
    const rand = mulberry32(5);
    const nations = ["ENG", "ESP", "GER", "ITA", "FRA", "POR", "NED", "BEL"];
    const pots = [0, 1, 2, 3].map((p) => nations.map((_, i) => `${nations[(i + p * 3) % 8]}-${p}`));
    const groups = drawGroups(pots, 8, rand, (a, b) => a.slice(0, 3) === b.slice(0, 3));
    expect(groups).toHaveLength(8);
    for (const g of groups) {
      expect(g).toHaveLength(4);
      expect(new Set(g.map((x) => x.slice(0, 3))).size).toBe(4);
      expect(g.map((x) => x.slice(-1))).toEqual(["0", "1", "2", "3"]);
    }
  });

  it("runs a group stage and builds the cross-over knockout", () => {
    const stage = groupStage([
      ["A1", "A2", "A3", "A4"],
      ["B1", "B2", "B3", "B4"],
    ]);
    const rand = mulberry32(2);
    stage.fixtures.forEach((days, g) => {
      for (const f of days.flat()) {
        const [h, a] = scoreline(rand, 1500, 1500);
        record(stage.groups[g], { ...f, homeScore: h, awayScore: a });
      }
    });
    const q = qualifiers(stage, 2);
    expect(q.map((g) => g.length)).toEqual([2, 2]);
    const slots = crossOver(
      q.map((g) => g[0].team),
      q.map((g) => g[1].team),
    );
    expect(slots).toEqual([q[0][0].team, q[1][1].team, q[1][0].team, q[0][1].team]);
  });
});

describe("ratings", () => {
  it("elo expectations and updates", () => {
    expect(expected(1500, 1500)).toBeCloseTo(0.5);
    expect(expected(1700, 1500)).toBeGreaterThan(0.7);
    const [a, b] = eloUpdate(1500, 1500, 1, 20);
    expect(a).toBeCloseTo(1510);
    expect(b).toBeCloseTo(1490);
  });

  it("scorelines average near the target and favour the stronger side", () => {
    const rand = mulberry32(9);
    let total = 0;
    let strongWins = 0;
    let weakWins = 0;
    for (let i = 0; i < 4000; i++) {
      const [x, y] = scoreline(rand, 1700, 1500);
      total += x + y;
      if (x > y) strongWins++;
      if (y > x) weakWins++;
    }
    expect(total / 4000).toBeGreaterThan(2.4);
    expect(total / 4000).toBeLessThan(3.0);
    expect(strongWins).toBeGreaterThan(weakWins * 2);
  });

  it("two-legged ties use aggregate, then the decider", () => {
    const tie = twoLegs("A", "B", (h) => (h === "A" ? { homeScore: 2, awayScore: 0 } : { homeScore: 1, awayScore: 0 }), () => "B");
    expect(tie).toMatchObject({ winner: "A", aggregate: [2, 1], decidedBy: "aggregate" });
    const level = twoLegs("A", "B", () => ({ homeScore: 1, awayScore: 1 }), () => "B");
    expect(level).toMatchObject({ winner: "B", decidedBy: "decider" });
    const p = penalties(mulberry32(1));
    expect(p.a).not.toBe(p.b);
  });
});

describe("ranking", () => {
  it("counts best N inside the window", () => {
    const entries = [
      { id: "a", t: 1, pts: 100 },
      { id: "a", t: 2, pts: 50 },
      { id: "a", t: 3, pts: 10 },
      { id: "b", t: 3, pts: 120 },
      { id: "c", t: -60, pts: 999 },
    ];
    const r = rank(entries, 3, { window: 52, best: 2 });
    expect(r.order).toEqual(["a", "b"]);
    expect(r.points.get("a")).toBe(150);
    expect(r.rankOf("b")).toBe(2);
    expect(r.rankOf("c")).toBeNull();
    expect(prune(entries, 3, 52)).toHaveLength(4);
  });
});
