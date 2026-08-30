import { describe, it, expect } from 'vitest';
import { buildResponsiveSrcSet } from './images';

describe('Responsive image helper (images.ts)', () => {
  describe('buildResponsiveSrcSet', () => {
    it('appends transform params to Supabase public storage URLs', () => {
      const srcset = buildResponsiveSrcSet('https://proj.supabase.co/storage/v1/object/public/property-images/a.jpg');
      expect(srcset).toContain('width=480&quality=80 480w');
      expect(srcset).toContain('width=1080&quality=80 1080w');
    });

    it('throws empty for an empty src', () => {
      expect(buildResponsiveSrcSet('')).toBe('');
    });

    it('falls back to a single 1x candidate for non-storage URLs', () => {
      const srcset = buildResponsiveSrcSet('https://cdn.example.com/banner.jpg');
      expect(srcset).toBe('https://cdn.example.com/banner.jpg 1x');
    });

    it('respects custom widths', () => {
      const srcset = buildResponsiveSrcSet(
        'https://proj.supabase.co/storage/v1/object/public/blog-images/x.png',
        [200, 400]
      );
      expect(srcset).toContain('width=200');
      expect(srcset).toContain('width=400');
      expect(srcset).not.toContain('width=480');
    });
  });
});
