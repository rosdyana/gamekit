import { describe, expect, it } from "vitest";
import { createSfx, gearing, notes } from "../src/index.js";

/** A recording stand-in for WebAudio: enough of the graph to see what was scheduled. */
type Call = [method: string, value: number, time: number, extra?: number];
class Param {
  calls: Call[] = [];
  constructor(public value = 0) {}
  setValueAtTime(v: number, t: number) {
    this.calls.push(["set", v, t]);
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.calls.push(["ramp", v, t]);
  }
  setTargetAtTime(v: number, t: number, k: number) {
    this.calls.push(["target", v, t, k]);
  }
}
class Node {
  type = "";
  loop = false;
  buffer: unknown = null;
  started: number | null = null;
  stopped: number | null = null;
  out: Node[] = [];
  gain = new Param(1);
  frequency = new Param(440);
  Q = new Param(1);
  constructor(public kind: string) {}
  connect(to: Node) {
    this.out.push(to);
    return to;
  }
  start(t = 0) {
    this.started = t;
  }
  stop(t = 0) {
    this.stopped = t;
  }
}
class FakeContext {
  currentTime = 10;
  sampleRate = 8000;
  state = "running";
  resumed = 0;
  nodes: Node[] = [];
  destination = new Node("destination");
  private make(kind: string) {
    const n = new Node(kind);
    this.nodes.push(n);
    return n;
  }
  createGain = () => this.make("gain");
  createOscillator = () => this.make("osc");
  createBiquadFilter = () => this.make("filter");
  createBufferSource = () => this.make("source");
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  resume() {
    this.resumed++;
    this.state = "running";
    return Promise.resolve();
  }
  of(kind: string) {
    return this.nodes.filter((n) => n.kind === kind);
  }
}

function setup(extra: Partial<Parameters<typeof createSfx>[0]> = {}) {
  const fake = new FakeContext();
  const sfx = createSfx({
    cues: {
      beep: { hz: 440, time: 0.1, vol: 0.2 },
      slide: { wave: "sine", hz: 180, to: 5, time: 0.1 },
      crash: [
        { kind: "noise", hz: 2600, to: 120, time: 0.7, vol: 0.6 },
        { wave: "sawtooth", hz: 160, to: 30, time: 0.5, at: 0.1 },
      ],
      roar: { kind: "noise", filter: "bandpass", hz: 1000, time: 2.2, swell: true },
    },
    context: () => fake as unknown as AudioContext,
    ...extra,
  });
  return { fake, sfx };
}

describe("sfx", () => {
  it("is silent and harmless until unlocked", () => {
    const { fake, sfx } = setup();
    sfx.play("beep");
    sfx.hush();
    expect(sfx.ready).toBe(false);
    expect(sfx.time).toBe(0);
    expect(fake.nodes).toHaveLength(0);
    sfx.unlock();
    expect(sfx.ready).toBe(true);
    expect(sfx.time).toBe(10);
    // Just the master gain, wired to the speakers.
    expect(fake.nodes).toHaveLength(1);
    expect(fake.nodes[0].out[0]).toBe(fake.destination);
  });

  it("survives a browser with no audio", () => {
    const sfx = createSfx({ cues: { beep: { hz: 440, time: 0.1 } }, context: () => null });
    sfx.unlock();
    sfx.play("beep");
    sfx.voice().set({ vol: 1 });
    expect(sfx.ready).toBe(false);
  });

  it("resumes a suspended context instead of making another", () => {
    const { fake, sfx } = setup();
    sfx.unlock();
    fake.state = "suspended";
    sfx.unlock();
    expect(fake.resumed).toBe(1);
    expect(fake.of("gain")).toHaveLength(1);
  });

  it("plays a tone: pitch, slide, fade, and it stops itself", () => {
    const { fake, sfx } = setup();
    sfx.unlock();
    sfx.play("beep");
    const [osc] = fake.of("osc");
    expect(osc.type).toBe("square");
    // No slide asked for: the pitch is set and left alone.
    expect(osc.frequency.calls).toEqual([["set", 440, 10]]);
    expect(osc.started).toBe(10);
    expect(osc.stopped).toBeCloseTo(10.12);
    const gain = osc.out[0];
    expect(gain.gain.calls[0]).toEqual(["set", 0.2, 10]);
    expect(gain.gain.calls[1][0]).toBe("ramp");
    expect(gain.out[0]).toBe(fake.nodes[0]);

    sfx.play("slide");
    const slide = fake.of("osc")[1];
    expect(slide.type).toBe("sine");
    // An exponential ramp cannot reach zero: slides are floored at 20 Hz.
    expect(slide.frequency.calls[1]).toEqual(["ramp", 20, 10.1]);
  });

  it("plays every step of a cue, staggered by `at`", () => {
    const { fake, sfx } = setup();
    sfx.unlock();
    sfx.play("crash");
    const [src] = fake.of("source");
    const [osc] = fake.of("osc");
    expect(src.loop).toBe(false);
    expect(src.out[0].type).toBe("lowpass");
    expect(src.out[0].frequency.calls).toEqual([
      ["set", 2600, 10],
      ["ramp", 120, 10.7],
    ]);
    expect(osc.started).toBeCloseTo(10.1);
  });

  it("loops long noise and can swell", () => {
    const { fake, sfx } = setup();
    sfx.unlock();
    sfx.play("roar");
    const [src] = fake.of("source");
    expect(src.loop).toBe(true);
    const filter = src.out[0];
    expect(filter.type).toBe("bandpass");
    const gain = filter.out[0].gain.calls;
    expect(gain[0][1]).toBeLessThan(0.01);
    expect(gain[1]).toEqual(["ramp", 0.1, 10 + 2.2 * 0.3]);
    expect(gain[2][2]).toBeCloseTo(12.2);
  });

  it("plays a cue given on the spot, and ignores unknown names", () => {
    const { fake, sfx } = setup();
    sfx.unlock();
    sfx.play(notes([523, 659, 784]));
    expect(fake.of("osc").map((o) => o.frequency.calls[0][1])).toEqual([523, 659, 784]);
    (sfx.play as (name: string) => void)("nope");
    expect(fake.of("osc")).toHaveLength(3);
  });

  it("mutes and sets volume on the master", () => {
    const { fake, sfx } = setup({ volume: 0.8 });
    sfx.unlock();
    const master = fake.nodes[0].gain;
    expect(master.value).toBe(0.8);
    expect(sfx.toggleMute()).toBe(true);
    expect(master.calls.at(-1)?.[1]).toBe(0);
    sfx.volume = 2;
    expect(sfx.volume).toBe(1);
    // Still muted: the new volume waits.
    expect(master.calls.at(-1)?.[1]).toBe(0);
    sfx.muted = false;
    expect(master.calls.at(-1)?.[1]).toBe(1);
  });

  it("starts muted when asked to", () => {
    const { fake, sfx } = setup({ muted: true });
    sfx.unlock();
    expect(fake.nodes[0].gain.value).toBe(0);
  });

  it("runs a layered voice that follows pitch, volume and filter", () => {
    const { fake, sfx } = setup();
    sfx.unlock();
    const engine = sfx.voice({
      wave: "sawtooth",
      layers: [{ wave: "square", ratio: 0.5 }],
      filter: { type: "lowpass", hz: 900 },
      hz: 60,
    });
    const [saw, sub] = fake.of("osc");
    expect([saw.type, sub.type]).toEqual(["sawtooth", "square"]);
    expect([saw.frequency.value, sub.frequency.value]).toEqual([60, 30]);
    expect(saw.started).not.toBeNull();
    const filter = saw.out[0];
    const gain = filter.out[0];
    expect(gain.gain.value).toBe(0);
    engine.set({ hz: 100, vol: 0.16, cutoff: 1200 }, 0.04);
    expect(saw.frequency.calls.at(-1)).toEqual(["target", 100, 10, 0.04]);
    expect(sub.frequency.calls.at(-1)).toEqual(["target", 50, 10, 0.04]);
    expect(gain.gain.calls.at(-1)).toEqual(["target", 0.16, 10, 0.04]);
    expect(filter.frequency.calls.at(-1)).toEqual(["target", 1200, 10, 0.04]);
    sfx.hush();
    expect(gain.gain.calls.at(-1)?.[1]).toBe(0);
  });

  it("keeps what a voice was told before the unlock", () => {
    const { fake, sfx } = setup();
    const wind = sfx.voice({ wave: "noise", filter: { type: "bandpass", hz: 700 } });
    wind.set({ vol: 0.3, cutoff: 500 });
    expect(fake.nodes).toHaveLength(0);
    sfx.unlock();
    const [src] = fake.of("source");
    expect(src.loop).toBe(true);
    expect(src.out[0].frequency.value).toBe(500);
    expect(src.out[0].out[0].gain.value).toBe(0.3);
  });
});

describe("helpers", () => {
  it("spaces notes out", () => {
    const run = notes([1, 2, 3], { time: 0.2, gap: 0.1, at: 1, vol: 0.05, wave: "triangle" });
    expect(run.map((n) => n.at)).toEqual([1, 1.1, 1.2]);
    expect(run[2]).toMatchObject({ hz: 3, time: 0.2, vol: 0.05, wave: "triangle" });
  });

  it("splits speed into gears", () => {
    expect(gearing(0)).toEqual({ gear: 0, revs: 0 });
    expect(gearing(0.3).gear).toBe(1);
    expect(gearing(0.3).revs).toBeCloseTo(0.2);
    // Flat out stays in top gear at full revs.
    expect(gearing(1)).toEqual({ gear: 3, revs: 1 });
    expect(gearing(2)).toEqual({ gear: 3, revs: 1 });
    expect(gearing(0.5, 2)).toEqual({ gear: 1, revs: 0 });
  });
});
