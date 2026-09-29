import { describe, expect, it } from "vitest";
import {
  backToBacks,
  draftLottery,
  draftOrder,
  expandMatchups,
  gamesBehind,
  gamesPerTeam,
  highScore,
  knockout,
  NBA_COUNTS,
  nextGame,
  planDivisional,
  playIn,
  playOut,
  playSeries,
  record,
  recordGame,
  runDraft,
  scheduleDays,
  series,
  seriesStatus,
  seriesWinner,
  standings,
  table,
  WIN_LOSS,
  winLoss,
  winPct,
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

const TEAMS = Array.from({ length: 30 }, (_, i) => `T${i}`);
const SHAPE = {
  conferences: [0, 1].map((c) => [0, 1, 2].map((d) => TEAMS.slice(c * 15 + d * 5, c * 15 + d * 5 + 5))),
};

describe("series", () => {
  it("follows 2-2-1-1-1 and stops at four wins", () => {
    const s = series("A", "B");
    expect([0, 1, 2, 3, 4, 5, 6].map((g) => nextGame(s, g).home).join("")).toBe("AABBABA");
    recordGame(s, 100, 90); // A home win
    recordGame(s, 100, 90);
    expect(seriesStatus(s)).toBe("A lead 2-0");
    recordGame(s, 100, 90); // B home win
    recordGame(s, 100, 90);
    expect(seriesStatus(s)).toBe("Series tied 2-2");
    expect(() => recordGame(s, 1, 1)).toThrow();
    // Home team always wins: A takes game 5, B game 6, A game 7.
    const w = playSeries(s, () => [101, 99]);
    expect(w).toBe("A");
    expect(s.games.length).toBe(7);
    expect(seriesStatus(s)).toBe("A win 4-3");
    expect(() => series("A", "B", 4)).toThrow();
  });

  it("plugs into knockouts", () => {
    const r = seeded(2);
    const elo: Record<string, number> = { A: 1700, B: 1400, C: 1500, D: 1450 };
    const ko = knockout(["A", "D", "B", "C"]);
    const champ = playOut(ko, (a, b) => {
      const s = series(a, b);
      return playSeries(s, (h, w) => highScore(r, elo[h], elo[w], { homeEdge: 60 }).slice(0, 2) as [number, number]);
    });
    expect(["A", "B", "C", "D"]).toContain(champ);
  });

  it("runs the play-in", () => {
    const p = playIn(["S7", "S8", "S9", "S10"], (h) => (h === "S8" || h === "S9" ? [90, 100] : [100, 90]));
    // S7 beats S8 at home; S10 wins at S9; S10 then wins at S8.
    expect(p.seventh).toBe("S7");
    expect(p.eighth).toBe("S10");
    expect(p.games.length).toBe(3);
  });
});

describe("highScore", () => {
  it("never ties and favours the stronger side", () => {
    const r = seeded(9);
    let wins = 0;
    let total = 0;
    for (let i = 0; i < 2000; i++) {
      const [a, b] = highScore(r, 1650, 1500);
      expect(a).not.toBe(b);
      if (a > b) wins++;
      total += a + b;
    }
    expect(wins / 2000).toBeGreaterThan(0.6);
    expect(total / 4000).toBeGreaterThan(100);
    expect(total / 4000).toBeLessThan(125);
  });
});

describe("divisional schedule", () => {
  it("gives every team 82 games with balanced home/away", () => {
    const plan = planDivisional(SHAPE, NBA_COUNTS, seeded(1));
    for (const n of gamesPerTeam(plan).values()) expect(n).toBe(82);
    const fx = expandMatchups(plan);
    expect(fx.length).toBe(1230);
    const home = new Map<string, number>();
    for (const f of fx) home.set(f.home, (home.get(f.home) ?? 0) + 1);
    for (const t of TEAMS) expect(home.get(t)).toBeGreaterThanOrEqual(40), expect(home.get(t)).toBeLessThanOrEqual(42);
  });

  it("lays games on days with no doubles and no three-in-three", () => {
    const fx = expandMatchups(planDivisional(SHAPE, NBA_COUNTS, seeded(4)));
    const days = scheduleDays(fx, seeded(5), { days: 175 });
    expect(days.flat().length).toBe(1230);
    for (const day of days) {
      const seen = new Set<string>();
      for (const f of day) {
        expect(seen.has(f.home) || seen.has(f.away)).toBe(false);
        seen.add(f.home);
        seen.add(f.away);
      }
    }
    for (const t of TEAMS) {
      const on = days.map((d) => d.some((f) => f.home === t || f.away === t));
      for (let d = 2; d < on.length; d++) expect(on[d] && on[d - 1] && on[d - 2]).toBe(false);
      const b2b = backToBacks(days, t);
      expect(b2b).toBeGreaterThan(0);
      expect(b2b).toBeLessThan(30);
    }
  });

  it("tracks win-loss tables", () => {
    const t = table(["A", "B"], WIN_LOSS);
    record(t, { home: "A", away: "B", homeScore: 110, awayScore: 100 });
    record(t, { home: "B", away: "A", homeScore: 99, awayScore: 101 });
    const [lead, second] = standings(t, ["points", "goalDifference"]);
    expect(lead.team).toBe("A");
    expect(winLoss(second)).toBe("0-2");
    expect(winPct(lead)).toBe(1);
    expect(gamesBehind(lead, second)).toBe(2);
  });
});

describe("draft", () => {
  it("draws the lottery by weight and keeps the rest in order", () => {
    const teams = TEAMS.slice(0, 14);
    const r = seeded(11);
    let worstFirst = 0;
    for (let i = 0; i < 4000; i++) {
      const l = draftLottery(teams, r);
      expect(new Set(l.order).size).toBe(14);
      if (l.order[0] === "T0") worstFirst++;
      // Picks 5+ are the non-drawn teams in reverse-standing order.
      const rest = l.order.slice(4);
      expect(rest).toEqual(teams.filter((t) => rest.includes(t)));
    }
    expect(worstFirst / 4000).toBeGreaterThan(0.11);
    expect(worstFirst / 4000).toBeLessThan(0.17);
  });

  it("builds a two-round order with traded picks and runs a board", () => {
    const order = draftOrder(["A", "B", "C"], 2, ["A", "B", "C"], (t, round) => (t === "A" && round === 2 ? "C" : t));
    expect(order.map((p) => `${p.overall}${p.team}`).join(" ")).toBe("1A 2B 3C 4C 5B 6C");
    const picks = runDraft(order, ["p1", "p2", "p3", "p4", "p5"], (team, avail) => (team === "B" ? avail.length - 1 : 0));
    expect(picks.map((x) => x.player)).toEqual(["p1", "p5", "p2", "p3", "p4"]);
    expect(seriesWinner(series("x", "y"))).toBeNull();
  });
});
