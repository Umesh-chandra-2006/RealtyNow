import { test, expect } from "@playwright/test";
import * as path from "path";

test.describe("RealtyNow Comparative Screenshot Generator", () => {
  const artifactsDir = "C:\\Users\\H S R KRISHNA\\.gemini\\antigravity\\brain\\7e9fff66-ee7f-4a96-863b-9df1009d8afe";

  test("Capture colleague site screenshots", async ({ page }) => {
    // Navigate to colleague live site
    await page.goto("https://realtynow.in/", { waitUntil: "networkidle" });
    
    // Set desktop screen resolution
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Take Hero section screenshot
    // We target the main banner/hero elements
    const hero = page.locator("section").first();
    await hero.screenshot({ path: path.join(artifactsDir, "colleague-hero.png") });

    // 2. Take App Showcase section screenshot
    // Find section containing "pocket" or tab buttons
    const showcase = page.locator("section:has-text('pocket'), section:has-text('app')").first();
    if (await showcase.count() > 0) {
      await showcase.screenshot({ path: path.join(artifactsDir, "colleague-showcase.png") });
    } else {
      // Fallback
      await page.screenshot({ path: path.join(artifactsDir, "colleague-showcase.png") });
    }

    // 3. Take Chat Launcher bubble screenshot
    // Wait for the whatsapp chat bubble or advisor launcher to load
    const chatBubble = page.locator("a[href*='wa.me'], button:has-text('chat')").first();
    if (await chatBubble.count() > 0) {
      // Capture viewport area around launcher
      await page.screenshot({ 
        path: path.join(artifactsDir, "colleague-chat.png"),
        clip: { x: 1000, y: 650, width: 250, height: 130 }
      });
    }
  });

  test("Capture our local site screenshots", async ({ page }) => {
    // Navigate to our local dev server
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Take Our Hero section screenshot
    const hero = page.locator("#heroSection");
    await hero.screenshot({ path: path.join(artifactsDir, "our-hero.png") });

    // 2. Take Our App Showcase section screenshot
    const showcase = page.locator(".showcase-section");
    await showcase.screenshot({ path: path.join(artifactsDir, "our-showcase.png") });

    // 3. Take Our Chat Launcher bubble screenshot
    const chatWidgetArea = page.locator(".chat-widget-container");
    if (await chatWidgetArea.count() > 0) {
      await page.screenshot({
        path: path.join(artifactsDir, "our-chat.png"),
        clip: { x: 1000, y: 650, width: 250, height: 130 }
      });
    } else {
      await page.screenshot({
        path: path.join(artifactsDir, "our-chat.png"),
        clip: { x: 1000, y: 650, width: 250, height: 130 }
      });
    }
  });
});
