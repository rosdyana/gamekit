/**
 * Synthesised game sound on WebAudio: no audio files, no dependencies.
 *
 * Two kinds of sound cover most games:
 * - cues: one-shots described as data (a beep, a thud, a crowd roar, a fanfare);
 * - voices: sounds that never stop and follow a game value (an engine, a siren, wind).
 */

/** A pitched blip: an oscillator sliding from one note to another while it fades out. */
export interface Tone {
  kind?: "tone";
  /** Oscillator shape (default `square`, the chiptune one). */
  wave?: OscillatorType;
  /** Pitch in Hz at the start, and where it slides to (default: stays put). */
  hz: number;
  to?: number;
  /** Length in seconds. */
  time: number;
  /** Loudness, 0 to 1 (default 0.1). */
  vol?: number;
  /** Seconds to wait before it starts (default 0). */
  at?: number;
}

/** Filtered white noise: thuds, crashes, tyres, surf, a crowd. */
export interface Noise {
  kind: "noise";
  /** Filter frequency in Hz at the start, and where it sweeps to (default: stays put). */
  hz: number;
  to?: number;
  /** `lowpass` (default) for impacts, `bandpass` for crowds and wind, `highpass` for hiss. */
  filter?: BiquadFilterType;
  q?: number;
  time: number;
  vol?: number;
  at?: number;
  /** Fade in over the first third instead of starting at full volume (a roar that builds). */
  swell?: boolean;
}

export type Step = Tone | Noise;
/** A sound effect: one step, or several played together (use `at` to stagger them). */
export type Cue = Step | readonly Step[];

/** A run of notes, one after another: jingles and fanfares. */
export function notes(
  hz: readonly number[],
  o: { time?: number; gap?: number; vol?: number; wave?: OscillatorType; at?: number } = {},
): Tone[] {
  const time = o.time ?? 0.14;
  const gap = o.gap ?? time * 0.85;
  return hz.map((f, i) => ({ hz: f, time, vol: o.vol, wave: o.wave, at: (o.at ?? 0) + i * gap }));
}

/**
 * Which gear, and how far through it, for a speed from 0 to 1: an engine note climbs through
 * each gear and drops back for the next.
 */
export function gearing(speed: number, gears = 4): { gear: number; revs: number } {
  const s = Math.max(0, Math.min(1, speed)) * gears;
  const gear = Math.min(gears - 1, Math.floor(s));
  return { gear, revs: s - gear };
}

/** A sound that never stops; it starts silent. */
export interface VoiceSpec {
  /** Oscillator shape, or `noise` for looping white noise (default `sawtooth`). */
  wave?: OscillatorType | "noise";
  /** More oscillators that follow the pitch at a ratio (0.5 = an octave down). */
  layers?: readonly { wave: OscillatorType; ratio: number }[];
  /** Everything passes through this filter; move it with `set({ cutoff })`. */
  filter?: { type: BiquadFilterType; hz: number; q?: number };
  /** Starting pitch in Hz (default 110). */
  hz?: number;
}

export interface VoiceState {
  /** Pitch in Hz (ignored by noise). */
  hz?: number;
  /** Loudness, 0 to 1. */
  vol?: number;
  /** Filter frequency in Hz. */
  cutoff?: number;
}

export interface Voice {
  /** Move toward these values; `glide` is how many seconds it takes to get most of the way (default 0.05). */
  set(state: VoiceState, glide?: number): void;
}

export interface SfxOptions<K extends string> {
  /** Named cues, played with `play("name")`. */
  cues?: Record<K, Cue>;
  /** Master volume, 0 to 1 (default 0.5). */
  volume?: number;
  muted?: boolean;
  /** Where the AudioContext comes from (default: the browser's). For tests. */
  context?: () => AudioContext | null;
  /** Source of the white noise (default Math.random). */
  random?: () => number;
}

export interface Sfx<K extends string> {
  /**
   * Browsers only allow sound after a key press or a tap: call this from one. Safe to call
   * again (it resumes a suspended context). Until then everything else is a silent no-op.
   */
  unlock(): void;
  /** True once `unlock` has an audio context. */
  readonly ready: boolean;
  /** Play a named cue, or one given on the spot. */
  play(cue: K | Cue): void;
  /** Start a continuous sound, silent until its volume is set. */
  voice(spec?: VoiceSpec): Voice;
  /** Silence every voice (leaving a level, pausing). */
  hush(glide?: number): void;
  muted: boolean;
  /** Flip mute; returns the new value. */
  toggleMute(): boolean;
  /** Master volume, 0 to 1. */
  volume: number;
  /** The audio clock in seconds (0 before `unlock`): for sounds that alternate on a beat. */
  readonly time: number;
}

const QUIET = 0.001;

function browserContext(): AudioContext | null {
  const g = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctx = g.AudioContext ?? g.webkitAudioContext;
  try {
    return Ctx ? new Ctx() : null;
  } catch {
    return null;
  }
}

interface LiveVoice {
  spec: VoiceSpec;
  state: Required<VoiceState>;
  oscs: { node: OscillatorNode; ratio: number }[];
  filter: BiquadFilterNode | null;
  gain: GainNode | null;
}

export function createSfx<K extends string = never>(opts: SfxOptions<K> = {}): Sfx<K> {
  const cues = (opts.cues ?? {}) as Record<string, Cue>;
  const random = opts.random ?? Math.random;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let muted = opts.muted ?? false;
  let volume = clamp01(opts.volume ?? 0.5);
  const voices: LiveVoice[] = [];

  const level = () => (muted ? 0 : volume);
  const applyLevel = () => {
    if (ctx && master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.02);
  };

  function build(v: LiveVoice) {
    if (!ctx || !master || !noise) return;
    const { spec, state } = v;
    v.gain = ctx.createGain();
    v.gain.gain.value = state.vol;
    let head: AudioNode = v.gain;
    if (spec.filter) {
      v.filter = ctx.createBiquadFilter();
      v.filter.type = spec.filter.type;
      v.filter.frequency.value = state.cutoff;
      if (spec.filter.q !== undefined) v.filter.Q.value = spec.filter.q;
      v.filter.connect(v.gain);
      head = v.filter;
    }
    v.gain.connect(master);
    const wave = spec.wave ?? "sawtooth";
    if (wave === "noise") {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      src.connect(head);
      src.start();
      return;
    }
    for (const layer of [{ wave, ratio: 1 }, ...(spec.layers ?? [])]) {
      const node = ctx.createOscillator();
      node.type = layer.wave;
      node.frequency.value = state.hz * layer.ratio;
      node.connect(head);
      node.start();
      v.oscs.push({ node, ratio: layer.ratio });
    }
  }

  function tone(c: AudioContext, out: GainNode, s: Tone) {
    const t = c.currentTime + (s.at ?? 0);
    const osc = c.createOscillator();
    osc.type = s.wave ?? "square";
    osc.frequency.setValueAtTime(s.hz, t);
    if (s.to !== undefined && s.to !== s.hz) osc.frequency.exponentialRampToValueAtTime(Math.max(20, s.to), t + s.time);
    const gain = c.createGain();
    gain.gain.setValueAtTime(s.vol ?? 0.1, t);
    gain.gain.exponentialRampToValueAtTime(QUIET, t + s.time);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + s.time + 0.02);
  }

  function burst(c: AudioContext, out: GainNode, s: Noise) {
    const t = c.currentTime + (s.at ?? 0);
    const src = c.createBufferSource();
    src.buffer = noise;
    // The buffer is a second long: loop it for anything longer.
    src.loop = s.time > 1;
    const filter = c.createBiquadFilter();
    filter.type = s.filter ?? "lowpass";
    if (s.q !== undefined) filter.Q.value = s.q;
    filter.frequency.setValueAtTime(s.hz, t);
    if (s.to !== undefined && s.to !== s.hz) filter.frequency.exponentialRampToValueAtTime(Math.max(20, s.to), t + s.time);
    const gain = c.createGain();
    const vol = s.vol ?? 0.1;
    if (s.swell) {
      gain.gain.setValueAtTime(QUIET, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + s.time * 0.3);
    } else gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(QUIET, t + s.time);
    src.connect(filter).connect(gain).connect(out);
    src.start(t);
    src.stop(t + s.time + 0.02);
  }

  return {
    unlock() {
      if (ctx) {
        if (ctx.state === "suspended") void ctx.resume();
        return;
      }
      ctx = (opts.context ?? browserContext)();
      if (!ctx) return;
      master = ctx.createGain();
      master.gain.value = level();
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1;
      voices.forEach(build);
    },
    get ready() {
      return ctx !== null;
    },
    play(cue) {
      if (!ctx || !master) return;
      const c = typeof cue === "string" ? cues[cue] : cue;
      if (!c) return;
      for (const s of Array.isArray(c) ? (c as readonly Step[]) : [c as Step]) {
        if (s.kind === "noise") burst(ctx, master, s);
        else tone(ctx, master, s);
      }
    },
    voice(spec = {}) {
      const v: LiveVoice = {
        spec,
        state: { hz: spec.hz ?? 110, vol: 0, cutoff: spec.filter?.hz ?? 0 },
        oscs: [],
        filter: null,
        gain: null,
      };
      voices.push(v);
      build(v);
      return {
        set(state, glide = 0.05) {
          Object.assign(v.state, state);
          if (!ctx || !v.gain) return;
          const now = ctx.currentTime;
          const k = Math.max(0.001, glide);
          if (state.hz !== undefined) for (const o of v.oscs) o.node.frequency.setTargetAtTime(state.hz * o.ratio, now, k);
          if (state.vol !== undefined) v.gain.gain.setTargetAtTime(state.vol, now, k);
          if (state.cutoff !== undefined) v.filter?.frequency.setTargetAtTime(state.cutoff, now, k);
        },
      };
    },
    hush(glide = 0.05) {
      for (const v of voices) {
        v.state.vol = 0;
        if (ctx && v.gain) v.gain.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.001, glide));
      }
    },
    get muted() {
      return muted;
    },
    set muted(on: boolean) {
      muted = on;
      applyLevel();
    },
    toggleMute() {
      muted = !muted;
      applyLevel();
      return muted;
    },
    get volume() {
      return volume;
    },
    set volume(v: number) {
      volume = clamp01(v);
      applyLevel();
    },
    get time() {
      return ctx?.currentTime ?? 0;
    },
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
