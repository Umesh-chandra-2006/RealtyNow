// Minimal TTL cache for hot read paths (mirrors the module-level Map cache
// pattern already used in search-engine.ts). Use for reference-data fetches
// that are expensive to hit Supabase for on every mount/keystroke and change
// rarely (cities, property types, featured config, etc.).

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

export function createTtlCache<T>(ttlMs: number) {
  const store = new Map<string, CacheEntry<T>>();
  return {
    get(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() - entry.timestamp > ttlMs) {
        store.delete(key);
        return undefined;
      }
      return entry.data;
    },
    set(key: string, data: T): void {
      store.set(key, { timestamp: Date.now(), data });
    },
    // Invalidate a single key (e.g. after an admin edit) or the whole cache.
    clear(key?: string): void {
      if (key) store.delete(key);
      else store.clear();
    },
  };
}

/**
 * Run an async loader with in-flight + TTL dedupe. Concurrent callers for the
 * same key share one promise while it is fresh; after TTL expiry the next call
 * re-runs the loader. Failures are NOT cached (the failed promise is dropped),
 * so transient errors retry naturally.
 */
export function cachedLoader<T>(
  cache: ReturnType<typeof createTtlCache<Promise<T>>>,
  key: string,
  loader: () => Promise<T>
): Promise<T> {
  const existing = cache.get(key);
  if (existing) return existing;
  const p = loader().catch((err) => {
    cache.clear(key);
    throw err;
  });
  cache.set(key, p);
  return p;
}