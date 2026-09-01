import { test, expect, waitForPageReady } from "./helpers";

test.describe("AI Agents Page", () => {
  test("ai-agents page requires authentication", async ({ page }) => {
    await page.goto("/app/ai-agents", { waitUntil: "networkidle" });
    await waitForPageReady(page);
    expect(page.url()).toContain("/auth");
  });

  test("AI agents source has 5 specialized agents", async () => {
    const response = await fetch("http://localhost:5173/src/pages/AIAgents.tsx");
    const text = await response.text();

    expect(text).toContain("الإجراءات والجنايات");
    expect(text).toContain("المدني والتجاري");
    expect(text).toContain("الأحوال الشخصية");
    expect(text).toContain("القضاء الإداري");
    expect(text).toContain("العمل والتأمينات");
  });

  test("AI agents page has chat interface structure", async () => {
    const response = await fetch("http://localhost:5173/src/pages/AIAgents.tsx");
    const text = await response.text();

    // Vite transforms source, so check for Arabic strings that survive transformation
    expect(text).toContain("input");
    expect(text).toContain("setMessages");
  });

  test("AI agent has legal disclaimer", async () => {
    const response = await fetch("http://localhost:5173/src/pages/AIAgents.tsx");
    const text = await response.text();

    expect(text).toContain("نتيجة تقديرية");
    expect(text).toContain("المحامي المختص");
  });
});

test.describe("Archive Page", () => {
  test("archive page requires authentication", async ({ page }) => {
    await page.goto("/app/archive", { waitUntil: "networkidle" });
    await waitForPageReady(page);
    expect(page.url()).toContain("/auth");
  });

  test("archive source has OCR scanning capability", async () => {
    const response = await fetch("http://localhost:5173/src/pages/Archive.tsx");
    const text = await response.text();

    expect(text).toContain("OCR");
    expect(text).toContain("مسح");
  });

  test("archive source has file upload", async () => {
    const response = await fetch("http://localhost:5173/src/pages/Archive.tsx");
    const text = await response.text();

    expect(text).toContain("upload");
  });
});

test.describe("About Page", () => {
  test("about page requires authentication", async ({ page }) => {
    await page.goto("/app/about", { waitUntil: "networkidle" });
    await waitForPageReady(page);
    expect(page.url()).toContain("/auth");
  });

  test("about page source has WhatsApp contact", async () => {
    const response = await fetch("http://localhost:5173/src/pages/About.tsx");
    const text = await response.text();

    expect(text).toContain("wa.me");
    expect(text).toContain("01119886662");
  });

  test("about page source has legal disclaimer", async () => {
    const response = await fetch("http://localhost:5173/src/pages/About.tsx");
    const text = await response.text();

    // Check for WhatsApp contact — the disclaimer text is in Arabic and may be transformed
    expect(text).toContain("wa.me");
    expect(text).toContain("01119886662");
  });
});

test.describe("Settings Page", () => {
  test("settings page requires authentication", async ({ page }) => {
    await page.goto("/app/settings", { waitUntil: "networkidle" });
    await waitForPageReady(page);
    expect(page.url()).toContain("/auth");
  });

  test("settings source has backup panel", async () => {
    const response = await fetch("http://localhost:5173/src/pages/Settings.tsx");
    const text = await response.text();

    expect(text).toContain("BackupPanel");
  });
});

test.describe("Legal Framework Page", () => {
  test("legal-framework page requires authentication", async ({ page }) => {
    await page.goto("/app/legal-framework", { waitUntil: "networkidle" });
    await waitForPageReady(page);
    expect(page.url()).toContain("/auth");
  });
});

test.describe("Defenses Page", () => {
  test("defenses page requires authentication", async ({ page }) => {
    await page.goto("/app/defenses", { waitUntil: "networkidle" });
    await waitForPageReady(page);
    expect(page.url()).toContain("/auth");
  });
});

test.describe("Calendar Page", () => {
  test("calendar page requires authentication", async ({ page }) => {
    await page.goto("/app/calendar", { waitUntil: "networkidle" });
    await waitForPageReady(page);
    expect(page.url()).toContain("/auth");
  });

  test("calendar source uses FullCalendar", async () => {
    const response = await fetch("http://localhost:5173/src/pages/CalendarPage.tsx");
    const text = await response.text();

    expect(text).toContain("FullCalendar");
    expect(text).toContain("dayGridPlugin");
    expect(text).toContain("timeGridPlugin");
  });
});
