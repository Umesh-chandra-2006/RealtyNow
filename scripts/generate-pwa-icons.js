#!/usr/bin/env node

/**
 * PWA Icon Generator
 * Generates maskable and standard PWA icons from a source image
 * Usage: node generate-pwa-icons.js
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceImage = path.join(__dirname, 'public', 'favicon.png');
const outputDir = path.join(__dirname, 'public');

const icons = [
  {
    name: 'pwa-192x192.png',
    size: 192,
    purpose: 'any',
  },
  {
    name: 'pwa-512x512.png',
    size: 512,
    purpose: 'any',
  },
  {
    name: 'maskable-icon-512x512.png',
    size: 512,
    purpose: 'maskable',
  },
  {
    name: 'apple-touch-icon.png',
    size: 180,
    purpose: 'any',
  },
];

async function generateIcons() {
  // Check if source image exists
  if (!fs.existsSync(sourceImage)) {
    console.error(`❌ Source image not found: ${sourceImage}`);
    console.error('Please ensure realtynow-icon.png is in the public folder');
    process.exit(1);
  }

  console.log('🎨 Generating PWA icons...\n');

  for (const icon of icons) {
    try {
      const outputPath = path.join(outputDir, icon.name);
      
      let pipeline;
      
      if (icon.purpose === 'maskable') {
        // Maskable icons need padding so they aren't cropped by the OS mask
        pipeline = sharp(sourceImage).resize(icon.size, icon.size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 } // White background for maskable
        });
      } else {
        // Standard icons just scale to fit
        pipeline = sharp(sourceImage).resize(icon.size, icon.size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        });
      }

      await pipeline.png().toFile(outputPath);
      console.log(`✅ Generated ${icon.name} (${icon.size}x${icon.size}, ${icon.purpose})`);
    } catch (error) {
      console.error(`❌ Error generating ${icon.name}:`, error.message);
      process.exit(1);
    }
  }

  console.log('\n✨ All PWA icons generated successfully!');
  console.log('📋 Icons are ready in the public/ folder');
}

generateIcons();
