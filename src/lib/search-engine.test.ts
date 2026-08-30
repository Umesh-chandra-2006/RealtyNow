import { describe, it, expect, vi } from 'vitest';

// search-engine.ts imports ./supabase at module load, which throws without
// env vars; the pure functions under test never call it, so stub the client.
vi.mock('./supabase', () => ({ supabase: {} }));

import { parsePropertySearchQuery, mapPropertyTypeToCategory } from './search-engine';

describe('Revenue query parser (search-engine.ts)', () => {
  describe('parsePropertySearchQuery', () => {
    it('parses a 2 BHK flat in Koramangala for rent under 50 lakh', () => {
      const intent = parsePropertySearchQuery('2 BHK flat for rent in Koramangala under 50 lakh');
      expect(intent.purpose).toBe('Rent');
      expect(intent.bedrooms).toBe(2);
      expect(intent.location.toLowerCase()).toContain('koramangala');
      expect(intent.maxPrice).toBe(50 * 100000);
    });

    it('parses a standalone price (rs prefix) as a max-price cap', () => {
      const intent = parsePropertySearchQuery('villa rs 2 cr bangalore');
      expect(intent.maxPrice).toBe(2 * 10000000);
      expect(intent.location.toLowerCase()).toContain('bangalore');
    });

    it('parses a between price range (1 to 3 cr)', () => {
      const intent = parsePropertySearchQuery('between 1 cr and 3 cr');
      expect(intent.minPrice).toBe(10000000);
      expect(intent.maxPrice).toBe(30000000);
    });

    it('detects property type keyword', () => {
      const intent = parsePropertySearchQuery('2bhk apartment in Hyderabad');
      expect(intent.propertyType).toBeTruthy();
    });

    it('returns empty fields for an empty query', () => {
      const intent = parsePropertySearchQuery('');
      expect(intent.location).toBe('');
      expect(intent.propertyType).toBeNull();
      expect(intent.purpose).toBeNull();
      expect(intent.bedrooms).toBeNull();
    });
  });

  describe('mapPropertyTypeToCategory', () => {
    it('maps land/plot types', () => {
      expect(mapPropertyTypeToCategory('Residential Plot')).toBe('plots');
      expect(mapPropertyTypeToCategory('Agricultural Land')).toBe('plots');
    });

    it('maps apartment variants', () => {
      expect(mapPropertyTypeToCategory('2 BHK Apartment')).toBe('apartment');
      expect(mapPropertyTypeToCategory('Studio')).toBe('apartment');
      expect(mapPropertyTypeToCategory('Flat')).toBe('apartment');
    });

    it('maps villa and independent house', () => {
      expect(mapPropertyTypeToCategory('Villa')).toBe('villa');
      expect(mapPropertyTypeToCategory('Independent House')).toBe('independent-house');
    });

    it('returns null for empty input', () => {
      expect(mapPropertyTypeToCategory('')).toBeNull();
    });
  });
});
