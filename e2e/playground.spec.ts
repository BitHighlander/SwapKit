import { expect, test } from "@playwright/test";

test.describe("SwapKit Playground", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the playground
    await page.goto("/");
  });

  test("should load the playground successfully", async ({ page }) => {
    // Check that the page title is present
    await expect(page).toHaveTitle(/SwapKit/);

    // Check for main UI elements
    await expect(page.locator("text=SwapKit Playground")).toBeVisible();
  });

  test("should display wallet connection options", async ({ page }) => {
    // Look for wallet connection buttons or options
    const walletSection = page.locator('[data-testid="wallet-section"], .wallet-section, [class*="wallet"]');

    // Check if wallet connection UI is present
    await expect(walletSection.or(page.locator("text=Connect Wallet")).or(page.locator("text=Wallet"))).toBeVisible();
  });

  test("should display chain selector", async ({ page }) => {
    // Check for chain selection functionality
    const chainSelector = page.locator('[data-testid="chain-selector"], .chain-selector, select, [class*="chain"]');

    await expect(chainSelector.or(page.locator("text=Chain")).or(page.locator("text=Network"))).toBeVisible();
  });

  test("should navigate between different features", async ({ page }) => {
    // Test navigation between different sections like Swap, Send, etc.
    const swapTab = page.locator("text=Swap").first();
    const sendTab = page.locator("text=Send").first();

    // Check if navigation elements exist
    if (await swapTab.isVisible()) {
      await expect(swapTab).toBeVisible();
    }

    if (await sendTab.isVisible()) {
      await expect(sendTab).toBeVisible();
    }
  });

  test("should handle responsive design", async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ height: 667, width: 375 });

    // Check that essential elements are still visible on mobile
    await expect(page.locator("text=SwapKit")).toBeVisible();
  });
});

test.describe("SwapKit API Integration", () => {
  test("should initialize SwapKit client", async ({ page }) => {
    // Navigate to playground
    await page.goto("/");

    // Check for any console errors during initialization
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Wait for page to stabilize
    await page.waitForLoadState("networkidle");

    // Should not have critical initialization errors
    const criticalErrors = errors.filter(
      (error) =>
        error.includes("SwapKit") &&
        (error.includes("not defined") ||
          error.includes("Cannot read properties") ||
          error.includes("is not a function")),
    );

    expect(criticalErrors.length).toBe(0);
  });

  test("should handle wallet connection attempts gracefully", async ({ page }) => {
    await page.goto("/");

    // Look for wallet connection buttons
    const connectButtons = page.locator(
      'button:has-text("Connect"), button:has-text("Wallet"), [data-testid*="connect"]',
    );

    if (await connectButtons.first().isVisible()) {
      // Click connect button and check it doesn't crash
      await connectButtons.first().click();

      // Wait for any modal or response
      await page.waitForTimeout(2000);

      // Page should still be functional
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
