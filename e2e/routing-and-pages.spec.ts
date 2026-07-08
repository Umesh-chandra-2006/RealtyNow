import { test, expect } from "@playwright/test";

test.describe("RealtyNow New Routes and Auxiliary Pages E2E Tests", () => {

  test("should verify the Services index page layout and routing links", async ({ page }) => {
    await page.goto("http://localhost:3000/services");
    
    // Check heading
    await expect(page.locator("h1")).toContainText("Services");
    
    // Check cards presence
    await expect(page.locator("text=Kaam Kaaka Legal Audits")).toBeVisible();
    await expect(page.locator("text=Premium Interior Styling")).toBeVisible();
    await expect(page.locator("text=RealtyNow Financials")).toBeVisible();
    
    // Verify direct link works
    await page.click("text=Verify Property");
    await expect(page).toHaveURL(/\/services\/kaam-kaaka/);
  });

  test("should verify the User Sign Up (Register) page layout and validation", async ({ page }) => {
    await page.goto("http://localhost:3000/register");
    
    await expect(page.locator("h1")).toContainText("Create your Account");
    
    // Check form fields
    const nameInput = page.locator("#fullName");
    const emailInput = page.locator("#email");
    const passwordInput = page.locator("#password");
    const phoneInput = page.locator("#phone");
    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(phoneInput).toBeVisible();
    
    // Try empty submit
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/register/);

    // Fill details and submit
    await nameInput.fill("Test Applicant");
    await emailInput.fill("test.applicant@gmail.com");
    await passwordInput.fill("password123");
    await phoneInput.fill("9999988888");
    await page.click("button[type='submit']");
    
    // Verifies it redirects to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("should verify the About Us corporate overview page content", async ({ page }) => {
    await page.goto("http://localhost:3000/about");
    
    await expect(page.locator("h1")).toContainText("Our Mission for Transparency");
    await expect(page.locator("text=Zero Brokerage Policy")).toBeVisible();
    await expect(page.locator("text=RERA Verification")).toBeVisible();
  });

  test("should verify the Contact page form submission", async ({ page }) => {
    await page.goto("http://localhost:3000/contact");
    
    await expect(page.locator("h1")).toContainText("Get in Touch");
    
    // Fill out feedback form
    await page.fill("#contactName", "Jane Doe");
    await page.fill("#contactEmail", "jane.doe@example.com");
    await page.selectOption("#inquiryType", "home-loan");
    await page.fill("#contactMessage", "I need a loan eligibility check for 3BHK flat.");
    
    // Submit form
    await page.click("button[type='submit']");
    
    // Check success notification
    await expect(page.locator("text=submitted successfully")).toBeVisible();
  });

  test("should verify the Services link in the header navigation", async ({ page }) => {
    await page.goto("http://localhost:3000/");
    
    // Check that header contains a link to Services
    const servicesLink = page.locator("#mainNav >> text=Services");
    await expect(servicesLink).toBeVisible();
    
    // Click and check routing
    await servicesLink.click();
    await expect(page).toHaveURL(/\/services/);
  });

  test("should verify the Profile dashboard (logged out state) redirects to login page", async ({ page }) => {
    await page.goto("http://localhost:3000/profile");
    
    // Verify auth guard redirects to login page
    await expect(page).toHaveURL(/\/login\?redirect=\/profile/);
  });
});
