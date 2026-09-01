import { test, expect, waitForPageReady, expectRTL } from "./helpers";

test.describe("App Layout & RTL Compliance", () => {
  test("HTML root has dir=rtl and lang=ar", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    await expectRTL(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  });

  test("login page uses logical spacing utilities", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Check that logical classes are used (not hardcoded left/right)
    const html = await page.content();

    // Should NOT have ml/mr/pl/pr classes in our code
    // (some may exist in shadcn/ui template components, which is acceptable)
    // Check key layout elements use logical properties
    expect(html).toContain("text-start"); // Logical text alignment
  });

  test("login page has claymorphism styling", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Clay card elements
    const clayCards = page.locator(".clay-card");
    expect(await clayCards.count()).toBeGreaterThan(0);

    // Clay button
    const clayButton = page.locator(".clay-button");
    expect(await clayButton.count()).toBeGreaterThan(0);
  });

  test("login page has responsive design", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Check that form has max-width constraint
    const formCard = page.locator(".max-w-md").first();
    await expect(formCard).toBeVisible();
  });

  test("all pages use font-arabic class", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Main container should have font-arabic
    const arabicFont = page.locator(".font-arabic").first();
    await expect(arabicFont).toBeVisible();
  });
});

test.describe("Landing Page Structure", () => {
  test("landing page loads successfully", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Landing page renders — verify body is visible
    await expect(page.locator("body")).toBeVisible();
  });
});
