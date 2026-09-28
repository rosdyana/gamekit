import { describe, expect, it } from "vitest";
import {
  asFn,
  between,
  chance,
  gauss,
  hashString,
  holder,
  int,
  mulberry32,
  next,
  pick,
  pickWeighted,
  shuffle,
} from "../src";

describe("rng", () => {
  it("replays identically from a serialised holder", () => {
    const a = holder(42);
    next(a);
    const saved = JSON.parse(JSON.stringify(a));
    const x = [next(a), next(a), next(a)];
    expect([next(saved), next(saved), next(saved)]).toEqual(x);
  });

  it("function and holder styles agree", () => {
    const f = mulberry32(7);
    const h = holder(7);
    expect([f(), f()]).toEqual([next(h), next(h)]);
    expect(asFn(holder(7))()).toBe(mulberry32(7)());
  });

  it("helpers stay in range", () => {
    const r = mulberry32(1);
    for (let i = 0; i < 500; i++) {
      const v = int(r, 3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
      const b = between(r, -1, 1);
      expect(b).toBeGreaterThanOrEqual(-1);
      expect(b).toBeLessThan(1);
      expect(Math.abs(gauss(r, 1))).toBeLessThanOrEqual(3);
    }
    expect(["a", "b"]).toContain(pick(r, ["a", "b"]));
    expect(typeof chance(r, 0.5)).toBe("boolean");
  });

  it("weights and shuffles", () => {
    const r = mulberry32(3);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 2000; i++) counts[pickWeighted(r, [["a", 3], ["b", 1]] as const)]++;
    expect(counts.a / 2000).toBeGreaterThan(0.68);
    expect(counts.a / 2000).toBeLessThan(0.82);
    const s = shuffle(r, [1, 2, 3, 4, 5]);
    expect([...s].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("hashes strings stably", () => {
    expect(hashString("IDN-abc")).toBe(hashString("IDN-abc"));
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});
