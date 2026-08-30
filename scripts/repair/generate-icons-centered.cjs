const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const srcIcon = path.join(__dirname, 'public', 'favicon.png');
const outDir = path.join(__dirname, 'public');

async function generateCenteredIcons() {
  console.log('Generating perfectly centered icons...');

  try {
    const trimmedLogoBuffer = await sharp(srcIcon)
      .trim()
      .toBuffer();

    console.log('Source image trimmed successfully.');

    const generateIcon = async (filename, size, paddingPercent, background, isMaskable) => {
      const targetLogoSize = Math.round(size * paddingPercent);

      const resizedLogo = await sharp(trimmedLogoBuffer)
        .resize({
          width: targetLogoSize,
          height: targetLogoSize,
          fit: 'inside'
        })
        .toBuffer();

      await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: background
        }
      })
      .composite([{
        input: resizedLogo,
        gravity: 'center'
      }])
      .png()
      .toFile(path.join(outDir, filename));

      console.log('Generated: ' + filename + ' (' + size + 'x' + size + ')');
    };

    await generateIcon('pwa-192x192.png', 192, 0.72, { r: 0, g: 0, b: 0, alpha: 0 });
    await generateIcon('pwa-512x512.png', 512, 0.72, { r: 0, g: 0, b: 0, alpha: 0 });
    await generateIcon('maskable-icon-512x512.png', 512, 0.68, { r: 255, g: 255, b: 255, alpha: 1 });
    await generateIcon('apple-touch-icon.png', 180, 0.75, { r: 255, g: 255, b: 255, alpha: 1 });

    console.log('All icons generated successfully with exact mathematical centering.');
  } catch (err) {
    console.error('Error generating icons:', err);
  }
}

generateCenteredIcons();
