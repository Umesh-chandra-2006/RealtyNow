import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../supabase';
import { buildPublishedQuery, type PropertyFilters } from '../properties';

/**
 * Regression guard for the public-search / published-only boundary.
 *
 * `buildPublishedQuery` intentionally targets the `v_properties_search` view
 * (migration 0142) which enforces the live/published boundary in Postgres. It
 * must NOT re-apply a standalone `.or('status...published...')` live-guard,
 * because in supabase-js a later chained `.or()` REPLACES (rather than ANDs
 * with) the earlier one — which was the root cause of non-live rows leaking
 * into public results. These tests lock that invariant in place.
 */

type ChainCall = { method: string; args: unknown[] };

function createMockChain() {
  const calls: ChainCall[] = [];
  const chain = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === 'then') return undefined; // not a real promise here
        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
          return chain;
        };
      },
    },
  );
  return { chain, calls };
}

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const LIVE_GUARD_RE =
  /status\.(eq|in|ilike)\.(published|live)|is_live\.eq\.|status\.in\.\([^)]*published/;

describe('buildPublishedQuery — published-only boundary', () => {
  let mock: { chain: unknown; calls: ChainCall[] };

  beforeEach(() => {
    mock = createMockChain();
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(mock.chain);
  });

  const defaultFilters: PropertyFilters = {};

  it('always reads from the v_properties_search view (never raw properties)', () => {
    const tableNames = new Set<string>();
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((t: string) => {
      tableNames.add(t);
      return mock.chain;
    });

    buildPublishedQuery({
      q: '2 bhk apartment in kondapur',
      category: 'apartment',
      locality_id: 'kondapur',
      purpose: 'buy',
      possession_status: 'Ready to Move',
      min_price: 1000000,
      max_price: 20000000,
      bedrooms: 2,
    });

    expect(tableNames.size).toBe(1);
    expect(tableNames.has('v_properties_search')).toBe(true);
    expect(tableNames.has('properties')).toBe(false);
  });

  it('never applies the standalone live/status guard via .or() that the view already enforces', () => {
    buildPublishedQuery({
      q: '2 bhk apartment in kondapur',
      category: 'apartment',
      locality_id: 'kondapur',
      purpose: 'buy',
      possession_status: 'Ready to Move',
      min_price: 1000000,
      max_price: 20000000,
      bedrooms: 2,
    });

    const orCalls = mock.calls.filter((c) => c.method === 'or');
    // The bug scenario needs multiple .or() groups chained after a guard.
    expect(orCalls.length).toBeGreaterThan(1);

    for (const call of orCalls) {
      const arg = String(call.args[0] ?? '');
      expect(arg).not.toMatch(LIVE_GUARD_RE);
    }
  });

  it('builds an effective query when no filters are provided', () => {
    const q = buildPublishedQuery(defaultFilters);
    expect(q).toBe(mock.chain);
    const methods = mock.calls.map((c) => c.method);
    expect(methods).toContain('select');
    expect(methods).toContain('range');
  });
});
