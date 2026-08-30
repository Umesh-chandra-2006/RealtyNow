# PWA Icon Setup Instructions

## Overview
This setup generates responsive PWA icons from a single source image. Your manifest.json is already configured to use these icons with full maskable support for modern Android devices.

## Step 1: Save Your Icon

The attached Triforce icon (red background with white triangles) needs to be saved to:

```
public/realtynow-icon.png
```

**In VS Code:**
1. Right-click on the image in the chat
2. Select "Save image as..."
3. Save to: `public/realtynow-icon.png`

Or using Windows File Explorer:
1. Extract the image from this chat
2. Save it to the `public/` folder as `realtynow-icon.png`

## Step 2: Generate Icon Sizes

Once the source image is in place, run:

```bash
npm run generate-icons
```

This will automatically create:
- ✅ `pwa-192x192.png` — Standard icon for PWA home screen
- ✅ `pwa-512x512.png` — Larger icon for splash screens
- ✅ `maskable-icon-512x512.png` — Adaptive icon for Android (can be masked as circle, rounded square, etc.)
- ✅ `apple-touch-icon.png` — iOS home screen icon

## Step 3: Verify & Deploy

After generation:

```bash
npm run build
npm run preview
```

Then visit your app and:
1. Open DevTools → Application → Manifest
2. Verify all icon paths are correct
3. Try adding to home screen (mobile):
   - **Android:** You'll see your icon in the app launcher, safely masked by the OS
   - **iOS:** You'll see it on the home screen

## About Maskable Icons

Maskable icons allow OS-level design flexibility. Your Triforce design works perfectly because:
- ✅ Simple, recognizable symbol
- ✅ Centered in the safe zone
- ✅ Works as circle, rounded square, or other shapes

The icon will be automatically displayed with padding so it never gets clipped.

## Troubleshooting

**Image not found error?**
- Ensure `realtynow-icon.png` is in the `public/` folder (not `public/icons/`)
- Filename must match exactly (case-sensitive on Linux servers)

**Icons not showing in PWA?**
- Clear browser cache: `Ctrl+Shift+Delete`
- Rebuild: `npm run build`
- Redeploy and reload

---

Questions? Check your manifest.json for the icon configuration.
