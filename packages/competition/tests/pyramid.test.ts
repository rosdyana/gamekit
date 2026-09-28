import { describe, expect, it } from "vitest";
import { allocate, promoteRelegate } from "../src";

describe("promoteRelegate", () => {
  const tiers = [
    ["A1", "A2", "A3", "A4", "A5", "A6"],
    ["B1", "B2", "B3", "B4", "B5", "B6"],
    ["C1", "C2", "C3", "C4"],
  ];

  it("swaps the same number across every boundary and keeps tier sizes", () => {
    const next = promoteRelegate(tiers, 2);
    expect(next.map((t) => t.length)).toEqual([6, 6, 4]);
    expect(next[0]).toEqual(["A1", "A2", "A3", "A4", "B1", "B2"]);
    // Survivors, then promoted from below, then relegated from above.
    expect(next[1]).toEqual(["B3", "B4", "C1", "C2", "A5", "A6"]);
    expect(next[2]).toEqual(["C3", "C4", "B5", "B6"]);
    expect(new Set(next.flat()).size).toBe(16);
  });

  it("takes one count per boundary", () => {
    const next = promoteRelegate(tiers, [3, 1]);
    expect(next[0]).toEqual(["A1", "A2", "A3", "B1", "B2", "B3"]);
    expect(next[1]).toEqual(["B4", "B5", "C1", "A4", "A5", "A6"]);
    expect(next[2]).toEqual(["C2", "C3", "C4", "B6"]);
    expect(promoteRelegate(tiers, [0, 0])).toEqual(tiers);
  });

  it("leaves inputs untouched and handles a single tier", () => {
    const copy = JSON.parse(JSON.stringify(tiers));
    promoteRelegate(tiers, 1);
    expect(tiers).toEqual(copy);
    expect(promoteRelegate([["X", "Y"]], 3)).toEqual([["X", "Y"]]);
  });

  it("throws on impossible moves", () => {
    expect(() => promoteRelegate(tiers, [1, 5])).toThrow(/exceeds/);
    expect(() => promoteRelegate(tiers, [7, 0])).toThrow(/exceeds/);
    // Middle tier of 6 cannot send 4 up and 3 down.
    expect(() => promoteRelegate(tiers, [4, 3])).toThrow(/cannot lose/);
    expect(() => promoteRelegate(tiers, [1])).toThrow(/Expected 2/);
    expect(() => promoteRelegate(tiers, -1)).toThrow();
  });
});

describe("allocate", () => {
  const order = ["a", "b", "c", "d", "e", "f", "g", "h"];

  it("splits a final order into slots in sequence", () => {
    const s = allocate(order, [
      { key: "cl", count: 4 },
      { key: "el", count: 2 },
      { key: "conf", count: 1 },
    ]);
    expect(s).toEqual({ cl: ["a", "b", "c", "d"], el: ["e", "f"], conf: ["g"] });
  });

  it("gives shorter lists when teams run out", () => {
    const s = allocate(["a", "b", "c"], [
      { key: "cl", count: 2 },
      { key: "el", count: 2 },
      { key: "down", count: 3 },
    ]);
    expect(s).toEqual({ cl: ["a", "b"], el: ["c"], down: [] });
  });
});
