// Build-time image optimizer.
//
// Converts the static raster images shipped in `public/` (hero shots, PWA
// banners, etc.) into AVIF + WebP in `public/optimized/`, emitting a manifest
// so the runtime can `<picture>`-source the most efficient format the browser
// supports.
//
// Usage: node scripts/optimize-images.mjs
// Wired into `npm run build` and runnable standalone via `npm run images`.
//
// Requires `sharp` (present as a devDependency). Runtime is fine without it —
// the `picture` fallback always makes `src` point at the original file.

import { readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import { join, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(ROOT, 'public');
const OUT_DIR = join(PUBLIC_DIR, 'optimized');
const MANIFEST = join(OUT_DIR, 'manifest.json');

// Only optimize these raster formats; skip svg (already vector) and everything
// under folders that ship pre-optimized assets or are not served as static
// images.
const RASTER_EXT = new Set(['.jpg', '.jpeg', '.png']);
const SKIP_DIRS = new Set(['optimized', 'builders', 'localities', 'partners', 'icons']);
// Files smaller than this are left untouched (not worth the AVIF/WebP overhead
// plus the extra request).
const MIN_BYTES = 20 * 1024;
// Skip already-optimized or generated descendants.
const SKIP_FILES = new Set(['app-mockup.png', 'app-showcase-bg.png']);

async function collectRasters(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) await collectRasters(join(dir, entry.name), out);
      continue;
    }
    const ext = extname(entry.name).toLowerCase();
    if (RASTER_EXT.has(ext) && !SKIP_FILES.has(entry.name)) out.push(join(dir, entry.name));
  }
  return out;
}

const formats = [
  { ext: 'avif', quality: 70 },
  { ext: 'webp', quality: 80 },
];

async function run() {
  const files = await collectRasters(PUBLIC_DIR);
  let optimized = 0;
  let skipped = 0;
  let totalSaved = 0;
  const manifestImages = {};

  for (const file of files) {
    const rel = relative(PUBLIC_DIR, file);
    const size = (await stat(file)).size;
    if (size < MIN_BYTES) {
      skipped += 1;
      continue;
    }
    const input = sharp(file);
    const metadata = await input.metadata();
    if (!metadata.width || !metadata.height) continue;

    const outBase = join(OUT_DIR, rel).replace(/\.[^.]+$/, '');
    const variants = [];
    for (const { ext, quality } of formats) {
      const outPath = `${outBase}.${ext}`;
      await mkdir(dirname(outPath), { recursive: true });
      await input.clone().rotate().resize({ width: metadata.width }).toFormat(ext, { quality }).toFile(outPath);
      const outSize = (await stat(outPath)).size;
      variants.push({ format: ext, url: `/${relative(PUBLIC_DIR, outPath).replace(/\\/g, '/')}`, size: outSize });
      totalSaved += Math.max(0, size - outSize);
      optimized += 1;
    }
    manifestImages[`/${rel.replace(/\\/g, '/')}`] = {
      originalWidth: metadata.width,
      originalHeight: metadata.height,
      variants,
    };
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    MANIFEST,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        images: manifestImages,
      },
      null,
      2
    )
  );

  console.log(`[optimize-images] optimized ${optimized} variants, skipped ${skipped} small files, est. ${(totalSaved / 1024 / 1024).toFixed(2)} MB saved (source weight).`);
  console.log(`[optimize-images] manifest written to public/optimized/manifest.json`);
}

run().catch((err) => {
  console.error('[optimize-images] failed:', err);
  process.exit(1);
});
