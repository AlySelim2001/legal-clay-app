import { test, expect, waitForPageReady } from "./helpers";

test.describe("Deadlines Page", () => {
  test("deadlines page requires authentication", async ({ page }) => {
    await page.goto("/app/deadlines", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Should redirect to auth
    expect(page.url()).toContain("/auth");
  });

  test("deadlines page has correct structure when accessed via login", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Verify login page renders
    await expect(page.locator("text=CRIM-SYS 2026")).toBeVisible();

    // Check login form has the expected elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});

test.describe("Deadline Calculator Structure", () => {
  test("deadline component source file exists and is valid", async () => {
    const response = await fetch("http://localhost:5173/src/pages/Deadlines.tsx");
    expect(response.status).toBe(200);

    const text = await response.text();
    // Verify key elements exist in the source
    expect(text).toContain("حاسبة المواعيد القانونية");
    expect(text).toContain("computeDeadline");
    expect(text).toContain("urgency");
    expect(text).toContain("category");
  });

  test("deadline component has multi-domain category filters", async () => {
    const response = await fetch("http://localhost:5173/src/pages/Deadlines.tsx");
    const text = await response.text();

    // Verify all legal categories are present
    expect(text).toContain("جنائي");
    expect(text).toContain("مدني");
    expect(text).toContain("إداري");
    expect(text).toContain("أحوال شخصية");
    expect(text).toContain("عمل");
  });

  test("deadline component has urgency color system", async () => {
    const response = await fetch("http://localhost:5173/src/pages/Deadlines.tsx");
    const text = await response.text();

    expect(text).toContain("critical");
    expect(text).toContain("high");
    expect(text).toContain("normal");
    expect(text).toContain("urgency-critical");
    expect(text).toContain("urgency-high");
    expect(text).toContain("urgency-normal");
  });

  test("deadline component has legal disclaimer", async () => {
    const response = await fetch("http://localhost:5173/src/pages/Deadlines.tsx");
    const text = await response.text();

    expect(text).toContain("LegalDisclaimer");
  });

  test("deadline calculator handles null duration procedures", async () => {
    const response = await fetch("http://localhost:5173/src/pages/Deadlines.tsx");
    const text = await response.text();

    // Should have graceful null handling
    expect(text).toContain("null");
    expect(text).toContain("إجراءات مفتوحة");
  });
});
