import { describe, it, expect, vi } from 'vitest';
import { createTtlCache, cachedLoader } from './ttl-cache';

describe('TTL cache utility (ttl-cache.ts)', () => {
  describe('createTtlCache', () => {
    it('stores and retrieves a value before TTL expiry', () => {
      const cache = createTtlCache<number>(1000);
      cache.set('k', 42);
      expect(cache.get('k')).toBe(42);
    });

    it('returns undefined for a missing key', () => {
      const cache = createTtlCache<number>(1000);
      expect(cache.get('nope')).toBeUndefined();
    });

    it('evicts a key after TTL expires', () => {
      vi.useFakeTimers();
      try {
        const cache = createTtlCache<number>(1000);
        cache.set('k', 1);
        vi.advanceTimersByTime(1500);
        expect(cache.get('k')).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it('clears a single key without affecting others', () => {
      const cache = createTtlCache<number>(1000);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear('a');
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
    });

    it('clears the whole cache', () => {
      const cache = createTtlCache<number>(1000);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
    });
  });

  describe('cachedLoader', () => {
    it('runs the loader once for concurrent calls with the same key', async () => {
      const cache = createTtlCache<Promise<string>>(10000);
      let calls = 0;
      const loader = async () => {
        calls += 1;
        return 'value';
      };
      const [r1, r2, r3] = await Promise.all([
        cachedLoader(cache, 'k', loader),
        cachedLoader(cache, 'k', loader),
        cachedLoader(cache, 'k', loader),
      ]);
      expect(r1).toBe('value');
      expect(r2).toBe('value');
      expect(r3).toBe('value');
      expect(calls).toBe(1);
    });

    it('does not cache a rejected loader, so it retries on the next call', async () => {
      const cache = createTtlCache<Promise<string>>(10000);
      let calls = 0;
      const loader = async () => {
        calls += 1;
        if (calls === 1) throw new Error('boom');
        return 'ok';
      };
      await expect(cachedLoader(cache, 'k', loader)).rejects.toThrow('boom');
      // Failure must not be cached: the next call re-runs the loader.
      await expect(cachedLoader(cache, 'k', loader)).resolves.toBe('ok');
      expect(calls).toBe(2);
    });

    it('re-runs the loader after TTL expiry', async () => {
      vi.useFakeTimers();
      try {
        const cache = createTtlCache<Promise<number>>(1000);
        let calls = 0;
        const loader = async () => {
          calls += 1;
          return calls;
        };
        expect(await cachedLoader(cache, 'k', loader)).toBe(1);
        expect(await cachedLoader(cache, 'k', loader)).toBe(1);
        await vi.advanceTimersByTimeAsync(1500);
        expect(await cachedLoader(cache, 'k', loader)).toBe(2);
        expect(calls).toBe(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
