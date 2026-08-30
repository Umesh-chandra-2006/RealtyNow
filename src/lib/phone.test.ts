import { describe, it, expect } from 'vitest';
import { normalizeIndianMobile, formatIndianMobileForDisplay } from './phone';

describe('Indian Mobile Normalization (phone.ts)', () => {
  describe('normalizeIndianMobile', () => {
    it('accepts a plain 10-digit valid Indian mobile', () => {
      expect(normalizeIndianMobile('9876543210')).toBe('919876543210');
    });

    it('accepts a mobile already prefixed with 91', () => {
      expect(normalizeIndianMobile('919876543210')).toBe('919876543210');
    });

    it('accepts a +91 prefixed mobile and strips formatting', () => {
      expect(normalizeIndianMobile('+91 98765 43210')).toBe('919876543210');
    });

    it('strips dashes, spaces and parentheses', () => {
      expect(normalizeIndianMobile('(+91)987-654-3210')).toBe('919876543210');
    });

    it('rejects numbers not starting with a valid Indian prefix digit', () => {
      // 5, 4, 3, 2, 1, 0 are NOT valid Indian mobile start digits
      expect(normalizeIndianMobile('5876543210')).toBeNull();
      expect(normalizeIndianMobile('1876543210')).toBeNull();
    });

    it('rejects too-short and too-long numbers', () => {
      expect(normalizeIndianMobile('987654321')).toBeNull();
      expect(normalizeIndianMobile('98765432101')).toBeNull();
    });

    it('rejects empty / invalid input', () => {
      expect(normalizeIndianMobile('')).toBeNull();
      expect(normalizeIndianMobile('abc123')).toBeNull();
      expect(normalizeIndianMobile('   ')).toBeNull();
    });

    it('returns null for an 11-digit 91-prefixed-wrong-format number', () => {
      // 91 + 9 digits is invalid (needs 91 + 10 digits)
      expect(normalizeIndianMobile('91987654321')).toBeNull();
    });
  });

  describe('formatIndianMobileForDisplay', () => {
    it('formats a normalized number with a leading +', () => {
      expect(formatIndianMobileForDisplay('9876543210')).toBe('+919876543210');
    });

    it('returns the raw input unchanged when normalization fails', () => {
      expect(formatIndianMobileForDisplay('not-a-number')).toBe('not-a-number');
    });
  });
});
