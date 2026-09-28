/**
 * Framework-free timing bar: a marker sweeps across; press inside the gold
 * (perfect) or green (good) zone. Works with keyboard (Space/Enter) and taps;
 * by default a tap anywhere on the page counts, since the bar is a small target on phones.
 */
export type TimingGrade = "perfect" | "good" | "poor" | "whiff";

export interface TimingWindow {
  /** Widths as fractions of the bar, centred on `target`. */
  perfect: number;
  good: number;
  /** Seconds for the marker to cross the bar. */
  duration: number;
  /** Centre of the sweet spot (default 0.72). */
  target?: number;
}

export interface TimingBarOptions {
  /** Hint under the bar (default "PRESS SPACE"). */
  hint?: string;
  /** Hint on touch screens (`pointer: coarse`); defaults to "TAP ANYWHERE" with `tapAnywhere`, else `hint`. */
  touchHint?: string;
  /** Any tap on the page counts as the press, not only taps on the bar (default true). */
  tapAnywhere?: boolean;
}

/** Taps on these never count as the press in `tapAnywhere` mode. */
const TAP_IGNORE = "button, a, input, select, textarea, label, [data-timing-ignore]";

export const DEFAULT_TARGET = 0.72;

/** Grade a press by its distance from the target. Past `poorLimit` it is a whiff. */
export function gradeFromOffset(offset: number, w: Pick<TimingWindow, "perfect" | "good">, poorLimit = 0.3): TimingGrade {
  const d = Math.abs(offset);
  if (d <= w.perfect / 2) return "perfect";
  if (d <= w.good / 2) return "good";
  if (d <= poorLimit) return "poor";
  return "whiff";
}

/** Simulated press for AI players: tighter spread = better timing. */
export function simulateGrade(w: TimingWindow, spread: number, rand: () => number = Math.random): TimingGrade {
  const noise = (rand() + rand() + rand() - 1.5) * 2 * spread;
  return gradeFromOffset(noise, w);
}

export class TimingBar {
  readonly el: HTMLElement;
  private readonly good: HTMLElement;
  private readonly perfect: HTMLElement;
  private readonly marker: HTMLElement;
  private readonly tapAnywhere: boolean;
  private cancelFn: (() => void) | null = null;

  constructor(parent: HTMLElement, opts: string | TimingBarOptions = {}) {
    const o = typeof opts === "string" ? { hint: opts } : opts;
    this.tapAnywhere = o.tapAnywhere ?? true;
    const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    const hint = touch
      ? (o.touchHint ?? (this.tapAnywhere ? "TAP ANYWHERE" : (o.hint ?? "TAP")))
      : (o.hint ?? "PRESS SPACE");
    this.el = document.createElement("div");
    this.el.className = "timing panel hidden";
    this.el.innerHTML = `<div class="track"><div class="good"></div><div class="perfect"></div><div class="marker"></div></div><div class="timing-hint">${hint}</div>`;
    parent.append(this.el);
    this.good = this.el.querySelector(".good")!;
    this.perfect = this.el.querySelector(".perfect")!;
    this.marker = this.el.querySelector(".marker")!;
  }

  /** Resolves with the grade, or null if cancel() is called first. */
  run(w: TimingWindow): Promise<TimingGrade | null> {
    this.cancel();
    const target = w.target ?? DEFAULT_TARGET;
    this.good.style.left = `${(target - w.good / 2) * 100}%`;
    this.good.style.width = `${w.good * 100}%`;
    this.perfect.style.left = `${(target - w.perfect / 2) * 100}%`;
    this.perfect.style.width = `${w.perfect * 100}%`;
    this.marker.style.left = "0%";
    this.el.classList.remove("hidden");

    return new Promise((resolve) => {
      const started = performance.now();
      let pos = 0;
      let raf = 0;
      const done = (g: TimingGrade | null) => {
        cancelAnimationFrame(raf);
        this.cancelFn = null;
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("pointerdown", onPointer);
        setTimeout(() => this.el.classList.add("hidden"), 120);
        resolve(g);
      };
      const onPress = () => done(gradeFromOffset(pos - target, w));
      const onPointer = (e: PointerEvent) => {
        // Ignore the tap that started this run (run() called from a pointerdown handler).
        if (e.timeStamp < started) return;
        const t = e.target as Element | null;
        if (!(t && this.el.contains(t))) {
          if (!this.tapAnywhere || t?.closest?.(TAP_IGNORE)) return;
        }
        e.preventDefault();
        onPress();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          onPress();
        }
      };
      const tick = () => {
        pos = (performance.now() - started) / 1000 / w.duration;
        this.marker.style.left = `${Math.min(1, pos) * 100}%`;
        if (pos >= 1) return done("whiff");
        raf = requestAnimationFrame(tick);
      };
      this.cancelFn = () => done(null);
      window.addEventListener("keydown", onKey);
      window.addEventListener("pointerdown", onPointer);
      raf = requestAnimationFrame(tick);
    });
  }

  cancel() {
    this.cancelFn?.();
  }

  destroy() {
    this.cancel();
    this.el.remove();
  }
}
