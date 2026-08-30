// Responsive-image helpers for RealtyNow.
//
// Two concerns:
//  1. Format negotiation (AVIF/WebP vs original) for the static assets we
//     optimize at build time with scripts/optimize-images.mjs (output into
//     public/optimized/ with a manifest).
//  2. Responsive width `srcset` for dynamic images (Supabase Storage public
//     URLs) surfaced on listing cards and hero art.
//
// All helpers degrade gracefully: if the manifest is not present or a variant
// is missing, callers fall back to the original `src`.

export interface ResolvedImageVariant {
  /** The most efficient available format URL for the given source, or null. */
  avif?: string;
  webp?: string;
  /** The original source URL, always used as the <img> src fallback. */
  src: string;
}

const MANIFEST_URL = '/optimized/manifest.json';

let manifestPromise: Promise<Record<string, unknown> | null> | null = null;
let manifestCache: Record<string, any> | null = null;

function loadManifest(): Promise<Record<string, any> | null> {
  if (manifestCache) return Promise.resolve(manifestCache);
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((data) => {
        manifestCache = data?.images || {};
        return manifestCache;
      });
  }
  return manifestPromise;
}

/**
 * Resolve the optimized AVIF/WebP variants for a static asset path if the
 * build-time optimizer produced them. Falls back to the original in all
 * failure cases.
 */
export async function resolveImageVariants(src: string): Promise<ResolvedImageVariant> {
  if (!src) return { src };
  try {
    const images = await loadManifest();
    const entry = images?.[src];
    if (!entry?.variants) return { src };
    const byFormat: Record<string, string> = {};
    for (const v of entry.variants) byFormat[v.format] = v.url;
    return {
      src,
      avif: byFormat.avif,
      webp: byFormat.webp,
    };
  } catch {
    return { src };
  }
}

/**
 * Build a `srcset` string of resized widths for a Supabase Storage public
 * image URL (or any URL that accepts `width=`/`height=` transform params, as
 * Supabase Image Resizing does via `?width=&quality=`).
 *
 * If the URL is already a public storage URL it gets transform params appended;
 * otherwise it returns a single 1x entry so `<img srcset>` stays valid.
 */
export function buildResponsiveSrcSet(
  src: string,
  widths: number[] = [480, 768, 1080, 1600]
): string {
  if (!src) return '';
  if (!/\/storage\/v1\/object\/public\//.test(src)) {
    return `${src} 1x`;
  }
  const base = src.startsWith('http') ? src : src;
  const sep = base.includes('?') ? '&' : '?';
  return widths.map((w) => `${base}${sep}width=${w}&quality=80 ${w}w`).join(', ');
}

/**
 * Convenience: returns sniff/browser-feature detection for HTML `<picture>`.
 * Prefer using resolveImageVariants with a <picture> element and this check for
 * the "AVIF first, WebP second, original last" ordering.
 */
export function supportsAvif(): boolean {
  if (typeof document === 'undefined') return false;
  return (
    (document.createElement('canvas')?.toDataURL('image/avif').indexOf('data:image/avif') === 0)
  );
}
