import { describe, expect, it } from "vitest";
import {
  ageAt,
  calendar,
  clamp,
  curve,
  drift,
  emptyMemory,
  EventDeck,
  isBirthday,
  pushLog,
  seasonOf,
  turnOf,
  weekOfYear,
  yearOf,
  type EventDef,
} from "../src/index.js";

interface State {
  money: number;
  mood: number;
  age: number;
}

const defs: EventDef<State, { bonus: number }>[] = [
  {
    id: "gift",
    title: "Gift",
    text: () => "Someone sends a gift.",
    weight: 1,
    cooldown: 10,
    choices: [{ label: "Take it", apply: (s, ctx) => ((s.money += ctx.bonus), "Nice.") }],
  },
  {
    id: "party",
    title: "Party",
    text: () => "Party?",
    weight: (s) => (s.age >= 18 ? 3 : 0),
    choices: [
      { label: "Go", apply: (s) => ((s.mood += 5), "Fun.") },
      { label: "Pay for everyone", blocked: (s) => (s.money < 100 ? "Too poor" : null), apply: (s) => ((s.money -= 100), "Generous."), tags: ["spend"] },
    ],
  },
  {
    id: "callUp",
    title: "Call-up",
    text: (_, e) => `Selected for ${String(e.data?.team)}`,
    once: true,
    choices: [{ label: "Accept", apply: () => "Proud.", tags: ["callUp"] }],
  },
];

describe("EventDeck", () => {
  it("filters by condition, weight and cooldown", () => {
    const deck = new EventDeck(defs);
    const mem = emptyMemory();
    const young: State = { money: 0, mood: 50, age: 15 };
    expect(deck.eligible(young, mem, 0).map(([d]) => d.id)).toEqual(["gift"]);
    const res = deck.resolve(young, { bonus: 5 }, { id: "gift" }, 0, mem, 3)!;
    expect(res.text).toBe("Nice.");
    expect(young.money).toBe(5);
    expect(deck.eligible(young, mem, 12).length).toBe(0);
    expect(deck.eligible(young, mem, 13).map(([d]) => d.id)).toEqual(["gift"]);
  });

  it("blocks choices and reports tags", () => {
    const deck = new EventDeck(defs);
    const s: State = { money: 10, mood: 50, age: 20 };
    expect(deck.resolve(s, { bonus: 0 }, { id: "party" }, 1, emptyMemory(), 0)).toBeNull();
    s.money = 500;
    expect(deck.resolve(s, { bonus: 0 }, { id: "party" }, 1, emptyMemory(), 0)!.choice.tags).toEqual(["spend"]);
  });

  it("fires scheduled events first and carries data", () => {
    const deck = new EventDeck(defs);
    const mem = emptyMemory();
    deck.schedule(mem, { id: "callUp", data: { team: "Indonesia" } }, 5);
    const s: State = { money: 0, mood: 50, age: 20 };
    expect(deck.roll(s, mem, 4, () => 0.99)).toBeNull();
    const e = deck.roll(s, mem, 5, () => 0.99)!;
    expect(deck.text(s, e)).toBe("Selected for Indonesia");
    // Memory is plain JSON.
    expect(JSON.parse(JSON.stringify(mem))).toEqual(mem);
  });

  it("rolls random events by weight", () => {
    const deck = new EventDeck(defs);
    let r = 0;
    const seq = [0.1, 0.9];
    const rand = () => seq[r++ % seq.length];
    expect(deck.roll({ money: 0, mood: 0, age: 20 }, emptyMemory(), 0, rand, 0.5)?.id).toBe("party");
    expect(() => new EventDeck([defs[0], defs[0]])).toThrow(/Duplicate/);
  });
});

describe("time", () => {
  const c = calendar(2026);
  it("converts turns to years, weeks and ages", () => {
    expect(yearOf(c, 0)).toBe(2026);
    expect(weekOfYear(c, 51)).toBe(52);
    expect(yearOf(c, 52)).toBe(2027);
    expect(turnOf(c, 2027, 1)).toBe(52);
    expect(ageAt(c, -14 * 52 - 3, 0)).toBe(14);
    expect(isBirthday(c, -52, 52)).toBe(true);
  });

  it("labels football seasons that start in August", () => {
    expect(seasonOf(c, turnOf(c, 2026, 40), 32).label).toBe("2026/27");
    expect(seasonOf(c, turnOf(c, 2027, 10), 32).label).toBe("2026/27");
    expect(seasonOf(c, turnOf(c, 2027, 33), 32).label).toBe("2027/28");
  });

  it("curves, clamps, drifts and logs", () => {
    const growth = curve([
      [14, 0.55],
      [24, 1],
      [30, 1],
      [36, 0.8],
    ]);
    expect(growth(10)).toBe(0.55);
    expect(growth(19)).toBeCloseTo(0.775);
    expect(growth(27)).toBe(1);
    expect(growth(40)).toBe(0.8);
    expect(clamp(120)).toBe(100);
    expect(drift(0, 100, 0.1)).toBe(10);
    expect(pushLog([1, 2, 3], 0, 3)).toEqual([0, 1, 2]);
  });
});
