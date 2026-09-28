/** Minimal async key-value store. Saves are strings (JSON). */
export interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
}

export function memoryStore(): Store {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => void m.set(k, v),
    del: async (k) => void m.delete(k),
    keys: async (p = "") => [...m.keys()].filter((k) => k.startsWith(p)),
  };
}

export function localStore(): Store {
  return {
    get: async (k) => localStorage.getItem(k),
    set: async (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch (e) {
        throw quota(e);
      }
    },
    del: async (k) => localStorage.removeItem(k),
    keys: async (p = "") => Object.keys(localStorage).filter((k) => k.startsWith(p)),
  };
}

function quota(e: unknown): Error {
  const name = (e as { name?: string })?.name;
  return name === "QuotaExceededError" ? new Error("Storage is full: delete old saves or export them") : (e as Error);
}

export function idbStore(db: IDBDatabase, storeName = "kv"): Store {
  const run = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
    new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(storeName, mode).objectStore(storeName));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(quota(req.error));
    });
  return {
    get: async (k) => (await run<string | undefined>("readonly", (s) => s.get(k))) ?? null,
    set: async (k, v) => void (await run("readwrite", (s) => s.put(v, k))),
    del: async (k) => void (await run("readwrite", (s) => s.delete(k))),
    keys: async (p = "") => ((await run("readonly", (s) => s.getAllKeys())) as IDBValidKey[]).map(String).filter((k) => k.startsWith(p)),
  };
}

/** IndexedDB when available (large quota), else localStorage, else memory. */
export async function openStore(dbName: string, storeName = "kv"): Promise<Store> {
  try {
    if (typeof indexedDB === "undefined") throw new Error("no indexedDB");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(storeName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return idbStore(db, storeName);
  } catch {
    try {
      localStorage.setItem("__probe", "1");
      localStorage.removeItem("__probe");
      return localStore();
    } catch {
      return memoryStore();
    }
  }
}
