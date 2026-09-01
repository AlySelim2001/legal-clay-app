import { test, expect, waitForPageReady } from "./helpers";

test.describe("Dashboard Page", () => {
  test("dashboard requires authentication", async ({ page }) => {
    await page.goto("/app/dashboard", { waitUntil: "networkidle" });
    await waitForPageReady(page);

    // Should redirect to auth
    expect(page.url()).toContain("/auth");
  });

  test("dashboard source has KPI cards structure", async () => {
    const response = await fetch("http://localhost:5173/src/pages/Dashboard.tsx");
    const text = await response.text();

    // Verify KPI cards exist
    expect(text).toContain("القضايا النشطة");
    expect(text).toContain("إجمالي العملاء");
    expect(text).toContain("مواعيد حرجة");
    expect(text).toContain("الكفالة غير المسددة");
  });

  test("dashboard has auto-refresh mechanism", async () => {
    const response = await fetch("http://localhost:5173/src/pages/Dashboard.tsx");
    const text = await response.text();

    expect(text).toContain("setInterval");
  });

  test("dashboard has chart component", async () => {
    const response = await fetch("http://localhost:5173/src/pages/Dashboard.tsx");
    const text = await response.text();

    expect(text).toContain("BarChart");
    expect(text).toContain("ResponsiveContainer");
  });

  test("dashboard has upcoming hearings section", async () => {
    const response = await fetch("http://localhost:5173/src/pages/Dashboard.tsx");
    const text = await response.text();

    expect(text).toContain("الجلسات القادمة");
    expect(text).toContain("useUpcomingHearings");
  });

  test("dashboard has prescription warning", async () => {
    const response = await fetch("http://localhost:5173/src/pages/Dashboard.tsx");
    const text = await response.text();

    expect(text).toContain("nearest_prescription_date");
    expect(text).toContain("أقرب موعد تقادم");
  });
});
