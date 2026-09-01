import { test as base, expect, type Page } from "@playwright/test";

// ─── Shared Helpers ───────────────────────────────────────────────

/** Wait for the page to finish loading (skeleton / spinner gone). */
export async function waitForPageReady(page: Page) {
  // Wait briefly for any transient loading spinners to disappear.
  // Some pages (e.g. Landing) have permanent spinners, so we use a short timeout
  // and don't fail if the spinner persists.
  const spinner = page.locator(".animate-spin").first();
  try {
    if (await spinner.isVisible({ timeout: 1_000 })) {
      await spinner.waitFor({ state: "hidden", timeout: 5_000 });
    }
  } catch {
    // Spinner persisted — likely a permanent element, not a blocker
  }
  // Extra settle time for lazy-loaded routes
  await page.waitForTimeout(300);
}

/** Assert the page has RTL direction set. */
export async function expectRTL(page: Page) {
  const dir = await page.getAttribute("html", "dir");
  expect(dir).toBe("rtl");
}

/** Assert the page has Arabic lang set. */
export async function expectArabicLang(page: Page) {
  const lang = await page.getAttribute("html", "lang");
  expect(lang).toBe("ar");
}

/** Navigate to a path and wait for the app to settle. */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  await waitForPageReady(page);
}

/** Check that a sidebar nav item is visible. */
export async function expectSidebarItem(page: Page, text: string) {
  const item = page.locator(`nav >> text="${text}"`).first();
  await expect(item).toBeVisible();
}

/** Count visible clay-card elements on the page. */
export async function countCards(page: Page) {
  return page.locator(".clay-card").count();
}

// ─── Custom Test Fixture ──────────────────────────────────────────

type CrimsysFixtures = {
  /** Navigate and wait for page ready */
  goto: (path: string) => Promise<void>;
};

export const test = base.extend<CrimsysFixtures>({
  goto: async ({ page }, use) => {
    const gotoFn = async (path: string) => {
      await navigateTo(page, path);
    };
    await use(gotoFn);
  },
});

export { expect };
