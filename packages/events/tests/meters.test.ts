import { describe, expect, it } from "vitest";
import { band, nudge, settle, type Meters } from "../src/index.js";

type Who = "coach" | "fans" | "agent";

describe("meters", () => {
  it("nudges one meter and clamps", () => {
    const m: Meters<Who> = { coach: 50, fans: 95, agent: 3 };
    expect(nudge(m, "coach", 12)).toBe(62);
    expect(nudge(m, "fans", 20)).toBe(100);
    expect(nudge(m, "agent", -10)).toBe(0);
    expect(nudge(m, "coach", 50, -100, 80)).toBe(80);
    expect(m).toEqual({ coach: 80, fans: 100, agent: 0 });
  });

  it("settles listed meters toward their targets only", () => {
    const m: Meters<Who> = { coach: 90, fans: 10, agent: 70 };
    settle(m, { coach: 50, fans: 50 }, 0.25);
    expect(m.coach).toBe(80);
    expect(m.fans).toBe(20);
    expect(m.agent).toBe(70);
    settle(m, { coach: 50 }, 1);
    expect(m.coach).toBe(50);
    settle(m, { agent: 50 }, 0);
    expect(m.agent).toBe(70);
    // Plain data: survives a save round trip.
    expect(JSON.parse(JSON.stringify(m))).toEqual(m);
  });

  it("labels values by ascending thresholds", () => {
    const bands = [
      [0, "Hostile"],
      [30, "Cold"],
      [55, "Warm"],
      [80, "Close"],
    ] as const;
    expect(band(72, bands)).toBe("Warm");
    expect(band(55, bands)).toBe("Warm");
    expect(band(29.9, bands)).toBe("Hostile");
    expect(band(100, bands)).toBe("Close");
    expect(band(-5, bands)).toBe("Hostile");
    expect(() => band(1, [])).toThrow();
  });
});
