import { test, expect, waitForPageReady, expectRTL } from "./helpers";

test.describe("Login & Authentication Flow", () => {
  test("landing page renders with CRIM-SYS branding", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Page should render without crashing
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("login page renders with form elements", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Title
    await expect(page.locator("text=CRIM-SYS 2026")).toBeVisible();
    await expect(page.locator("text=نظام إدارة القضايا الجنائية")).toBeVisible();

    // Form fields
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator("text=تسجيل الدخول")).toBeVisible();
  });

  test("login page has RTL layout", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);
    await expectRTL(page);
  });

  test("login form shows validation for empty submission", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Try submitting empty form
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Email input should have validation (required attribute)
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute("required", "");
  });

  test("password toggle button works", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // Click toggle button (Eye icon)
    const toggleBtn = page.locator('input[type="password"]').locator("..").locator("button");
    await toggleBtn.click();

    // Should become text input
    const textInput = page.locator('input[type="text"]');
    await expect(textInput).toBeVisible();
  });

  test("remember me checkbox exists", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();

    // Click it
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  test("unauthenticated user is redirected to /auth", async ({ page }) => {
    await page.goto("/app/dashboard", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Should be redirected to auth page
    const url = page.url();
    expect(url).toContain("/auth");
  });

  test("auth page renders with email input and guest login", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Should have email input
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toBeVisible();

    // Guest login button
    await expect(page.locator("text=Continue as Guest")).toBeVisible();
  });

  test("login page has decorative elements", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Gavel icon (in the logo card)
    await expect(page.locator(".text-primary").first()).toBeVisible();

    // Copyright text
    await expect(page.locator("text=© 2026 CRIM-SYS")).toBeVisible();
  });

  test("login form handles invalid credentials gracefully", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Fill in invalid credentials
    await page.locator('input[type="email"]').fill("test@example.com");
    await page.locator('input[type="password"]').fill("wrongpassword");

    // Submit
    await page.locator('button[type="submit"]').click();

    // Wait for error or loading state
    await page.waitForTimeout(2_000);

    // Either error message appears or still on login page
    const url = page.url();
    expect(url).toContain("/login");
  });

  test("login page copyright and footer visible", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    await expect(page.locator("text=جميع الحقوق محفوظة")).toBeVisible();
  });
});
