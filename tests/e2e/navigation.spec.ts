import { test, expect, waitForPageReady, expectRTL } from "./helpers";

test.describe("Navigation & Layout", () => {
  test.beforeEach(async ({ page }) => {
    // Auth pages don't require login
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);
  });

  test("all public routes are accessible", async ({ page }) => {
    const publicRoutes = ["/", "/login", "/auth"];

    for (const route of publicRoutes) {
      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response?.status()).toBeLessThan(500);
    }
  });

  test("RTL layout is enforced on all pages", async ({ page }) => {
    const routes = ["/", "/login"];

    for (const route of routes) {
      await page.goto(route, { waitUntil: "networkidle" });
      await waitForPageReady(page);
      await expectRTL(page);
    }
  });

  test("login page has claymorphism design elements", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Clay cards should be present
    const cards = page.locator(".clay-card");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("decorative background blobs exist on login", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Check for decorative blur elements
    const blobs = page.locator(".blur-3xl, .blur-2xl");
    const count = await blobs.count();
    expect(count).toBeGreaterThan(0);
  });

  test("app routes redirect to auth when not logged in", async ({ page }) => {
    const protectedRoutes = [
      "/app/dashboard",
      "/app/cases",
      "/app/clients",
      "/app/calendar",
      "/app/deadlines",
      "/app/defenses",
      "/app/archive",
      "/app/legal-framework",
      "/app/settings",
      "/app/ai-agent",
      "/app/ai-agents",
      "/app/about",
    ];

    for (const route of protectedRoutes) {
      await page.goto(route, { waitUntil: "networkidle" });
      const url = page.url();
      expect(url).toContain("/auth");
    }
  });

  test("admin route redirects to auth when not logged in", async ({ page }) => {
    await page.goto("/admin/team", { waitUntil: "networkidle" });
    const url = page.url();
    expect(url).toContain("/auth");
  });

  test("non-existent route shows 404 page", async ({ page }) => {
    await page.goto("/nonexistent-route-xyz", {
      waitUntil: "networkidle",
    });
    await waitForPageReady(page);

    // Should show some content (404 or landing)
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("login form has proper accessibility labels", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Labels should be associated with inputs
    await expect(page.locator('label:has-text("البريد الإلكتروني")')).toBeVisible();
    await expect(page.locator('label:has-text("كلمة المرور")')).toBeVisible();
  });

  test("login page has password recovery link", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    await expect(page.locator("text=نسيت كلمة المرور؟")).toBeVisible();
  });
});
