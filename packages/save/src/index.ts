export * from "./store.js";
export * from "./manager.js";

/** Coalesce frequent changes into one write after `ms` of quiet. */
export function createAutosaver(write: () => Promise<unknown>, ms = 300) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Promise<unknown> = Promise.resolve();
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = write();
    return pending;
  };
  return {
    schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), ms);
    },
    flush,
    get pending() {
      return timer !== null;
    },
  };
}

/** Small synchronous settings object in localStorage (safe in private mode). */
export function settingsStore<T extends object>(key: string, defaults: T) {
  return {
    load(): T {
      try {
        const raw = localStorage.getItem(key);
        return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<T>) } : { ...defaults };
      } catch {
        return { ...defaults };
      }
    },
    save(value: T) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Blocked storage: settings just won't persist.
      }
    },
  };
}

/** Trigger a browser download of text (e.g. an exported save). */
export function downloadText(filename: string, text: string, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
