import { useEffect, useState } from "preact/hooks";

/**
 * Tiny observable for games that mutate state in place (simulations): call
 * `notify()` after changes, and components using `useStore` re-render.
 */
export interface Store {
  subscribe(fn: () => void): () => void;
  notify(): void;
}

export function createStore(): Store {
  const listeners = new Set<() => void>();
  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    notify() {
      for (const fn of listeners) fn();
    },
  };
}

export function useStore(store: Store) {
  const [, force] = useState(0);
  useEffect(() => store.subscribe(() => force((n) => n + 1)), [store]);
}
