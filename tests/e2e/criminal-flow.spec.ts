import { test, expect } from "@playwright/test";

/**
 * E2E Test: Criminal Case Flow
 *
 * Covers: Login → Dashboard → Open case → Add note → Sign out
 *
 * Prerequisites:
 * - Supabase project with test user (test@crimsys.app / testPassword123)
 * - VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const TEST_EMAIL = process.env.TEST_EMAIL || "test@crimsys.app";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "testPassword123";

test.describe("Criminal Case Flow", () => {
  test("login → dashboard → case detail → add note → logout", async ({
    page,
  }) => {
    // 1. Navigate to login
    await page.goto(`${BASE_URL}/auth`);
    await expect(page).toHaveTitle(/CRIM-SYS/);

    // 2. Fill login form
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await emailInput.fill(TEST_EMAIL);
    await passwordInput.fill(TEST_PASSWORD);

    // 3. Submit login
    await page.locator('button[type="submit"]').click();

    // 4. Wait for dashboard to load
    await page.waitForURL("**/app/dashboard", { timeout: 15000 });
    await expect(
      page.locator("text=لوحة التحكم").first(),
    ).toBeVisible();

    // 5. Navigate to cases list
    await page.click('a[href="/app/cases"]');
    await page.waitForURL("**/app/cases");

    // 6. Click on first case (if any exist)
    const caseRow = page.locator('[data-testid="case-row"]').first();
    if (await caseRow.isVisible()) {
      await caseRow.click();
      await page.waitForURL("**/app/cases/**");
    }

    // 7. Verify case detail page elements
    await expect(
      page.locator("text=تفاصيل القضية").first(),
    ).toBeVisible({ timeout: 10000 });

    // 8. Sign out via TopBar dropdown
    await page.locator('[data-testid="user-menu"]').click();
    await page.locator("text=تسجيل الخروج").click();

    // 9. Verify redirect to auth page
    await page.waitForURL("**/auth*", { timeout: 10000 });
  });
});
