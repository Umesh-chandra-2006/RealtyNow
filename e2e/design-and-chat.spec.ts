import { test, expect } from "@playwright/test";

test.describe("RealtyNow UI Design and Chat Assistant (Huashu) Tests", () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`PAGE CONSOLE ERROR: ${msg.text()}`);
      }
    });
    page.on('pageerror', err => {
      console.error(`PAGE UNCAUGHT ERROR: ${err.message}`);
    });
    // Navigate to local development server
    await page.goto("http://localhost:3000/");
  });

  test("should load the landing page and verify visual design sections", async ({ page }) => {
    // Verify Page Title
    await expect(page).toHaveTitle(/RealtyNow/);

    // Verify Header Logo presence
    const logo = page.locator("#logoLink");
    await expect(logo).toBeVisible();
    await expect(logo).toHaveText("RealtyNow");

    // Verify Hero Section Elements
    const hero = page.locator("#heroSection");
    await expect(hero).toBeVisible();
    await expect(hero.locator("h1")).toContainText("Find Your");

    // Verify Featured Properties Cards are rendered
    const propertyCards = page.locator(".project-card");
    await expect(propertyCards).toHaveCount(3);

    // Verify that cards have the sheen glow class applied
    await expect(propertyCards.first()).toHaveClass(/sheen-glow/);
    await expect(propertyCards.first()).toHaveClass(/gradient-border/);

    // Verify Why Choose Us Section
    const whySection = page.locator("#whyChooseUsSection");
    await expect(whySection).toBeVisible();
    const whyCards = whySection.locator(".why-card");
    await expect(whyCards).toHaveCount(4);
    await expect(whyCards.first()).toHaveClass(/sheen-glow/);
  });

  test("should verify the interactive mobile app mockup screen switcher", async ({ page }) => {
    const showcase = page.locator(".showcase-section");
    await expect(showcase).toBeVisible();

    // Verify initial mock screen shows the chat interface by default
    const phoneScreen = page.locator(".phone-screen");
    await expect(phoneScreen).toBeVisible();
    await expect(phoneScreen.locator("text=Meera T. (Owner)")).toBeVisible();

    // Click "RERA Verify" tab
    await page.click("text=RERA Verify");
    // Verify RERA screen content appears in the mockup
    await expect(phoneScreen.locator("text=RERA APPROVED")).toBeVisible();
    await expect(phoneScreen.locator("text=HRERA-2024-9102")).toBeVisible();

    // Click "Yield Trends" tab
    await page.click("text=Yield Trends");
    // Verify Yield analytics screen content appears in the mockup
    await expect(phoneScreen.locator("text=Investment Analytics")).toBeVisible();
    await expect(phoneScreen.locator("text=6.82%")).toBeVisible();
  });

  test("should verify the Chat Assistant launcher and conversational scripting (Huashu)", async ({ page }) => {
    // Check floating WhatsApp button is visible on page load
    const whatsappBtn = page.locator(".floating-action-btn--whatsapp");
    await expect(whatsappBtn).toBeVisible();

    // Click Chat Assistant Launcher
    const launcher = page.locator(".chat-launcher");
    await expect(launcher).toBeVisible();
    await launcher.click();

    // Check Chat Window opens
    const chatWindow = page.locator(".chat-window");
    await expect(chatWindow).toBeVisible();
    await expect(chatWindow.locator(".chat-header h3")).toHaveText("RealtyNow Assistant");

    // Check Welcome Message
    await expect(chatWindow.locator("text=Ask me anything about our pre-launch")).toBeVisible();

    // 1. Test "RERA Checks" Huashu Chip
    await page.click("text=RERA Checks");
    // Check bot response explaining RERA database checks
    await expect(chatWindow.locator("text=rigorous multi-point verification")).toBeVisible();

    // 2. Test "Search Gurgaon" Huashu Chip
    await page.click("text=Search Gurgaon");
    // Check bot response with links
    await expect(chatWindow.locator("text=metros in India")).toBeVisible();
    const browseLink = chatWindow.locator("text=Browse Properties Now");
    await expect(browseLink).toBeVisible();
    await expect(browseLink).toHaveAttribute("href", "/listings?type=buy");

    // 3. Test "Early Access Perks" Huashu Chip
    await page.click("text=Early Access Perks");
    // Check bot response details
    await expect(chatWindow.locator("text=zero platform brokerage")).toBeVisible();

    // 4. Test "Talk to Advisor" Huashu Chip
    await page.click("text=Talk to Advisor");
    // Check bot response and WhatsApp redirect link
    await expect(chatWindow.locator("text=chat with a verified property advisor")).toBeVisible();
    const whatsappLink = chatWindow.locator("text=Chat on WhatsApp");
    await expect(whatsappLink).toBeVisible();
    await expect(whatsappLink).toHaveAttribute("href", "https://wa.me/919494230774");

    // 5. Test Custom Input Field sending logic
    const chatInput = page.locator(".chat-input");
    await chatInput.fill("I want to buy a flat");
    await page.click(".chat-send-btn");

    // Check custom user bubble appears
    await expect(chatWindow.locator(".chat-msg--user:has-text('I want to buy a flat')")).toBeVisible();
    // Check bot answers accordingly
    await expect(chatWindow.locator("text=explore our live property listing feed")).toBeVisible();
  });
});
