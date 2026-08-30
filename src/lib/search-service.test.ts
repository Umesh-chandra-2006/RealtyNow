import { describe, it, expect, vi } from 'vitest';

// search-service.ts imports ./supabase at module load, which throws without
// env vars; calculateRelevanceScore is pure and never calls it, so stub it.
vi.mock('./supabase', () => ({ supabase: {} }));

import { calculateRelevanceScore } from './search-service';
import type { ParsedSearchIntent } from './search-engine';

function intent(overrides: {
  location?: string;
  propertyType?: string | null;
  purpose?: 'Sale' | 'Rent' | null;
  bedrooms?: number | null;
  maxPrice?: number | null;
  minPrice?: number | null;
  originalQuery?: string;
}): ParsedSearchIntent {
  const base: ParsedSearchIntent = {
    location: '',
    propertyType: null,
    purpose: null,
    bedrooms: null,
    maxPrice: null,
    minPrice: null,
    originalQuery: 'test',
  };
  return Object.assign(base, overrides);
}

describe('Relevance ranking (search-service.ts)', () => {
  describe('calculateRelevanceScore', () => {
    it('returns a default boost for a blank query based on featured/verified', () => {
      const featured = calculateRelevanceScore({ is_featured: true }, '', {} as any);
      const plain = calculateRelevanceScore({}, '', {} as any);
      expect(featured).toBeGreaterThan(0);
      expect(plain).toBe(0);
    });

    it('scores an exact title match higher than a partial match', () => {
      const prop = { title: 'Sunset 2BHK Apartment', city_name: 'Bangalore' };
      const exact = calculateRelevanceScore(prop, 'sunset 2bhk apartment', intent({ location: 'bangalore' }));
      const partial = calculateRelevanceScore(
        prop,
        'sunset 2bhk apartment in hyderabad',
        intent({ location: 'hyderabad' })
      );
      expect(exact).toBeGreaterThan(partial);
    });

    it('adds a bonus when the property fits inside the max price', () => {
      const within = calculateRelevanceScore(
        { title: 'A', price: 2500000 },
        'under 50 lakh apartment',
        intent({ maxPrice: 5000000, propertyType: 'apartment' })
      );
      const over = calculateRelevanceScore(
        { title: 'A', price: 90000000 },
        'under 50 lakh apartment',
        intent({ maxPrice: 5000000, propertyType: 'apartment' })
      );
      expect(within).toBeGreaterThan(over);
    });

    it('rewards matching property type category', () => {
      const match = calculateRelevanceScore(
        { title: 'A', property_type_name: 'Apartment' },
        'apartment in bangalore',
        intent({ propertyType: 'apartment', location: 'bangalore' })
      );
      const noMatch = calculateRelevanceScore(
        { title: 'A', property_type_name: 'Villa' },
        'apartment in bangalore',
        intent({ propertyType: 'apartment', location: 'bangalore' })
      );
      expect(match).toBeGreaterThan(noMatch);
    });

    it('never returns a negative score', () => {
      const score = calculateRelevanceScore(
        { title: 'Anything' },
        'nonsense query that should not match',
        intent({ originalQuery: 'nonsense query that should not match' })
      );
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });
});
