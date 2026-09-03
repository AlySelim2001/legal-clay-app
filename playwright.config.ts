import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for CRIM-SYS 2026 E2E tests.
 *
 * Runs in headless Chromium with an Android-like viewport (393×851)
 * to simulate the Capacitor WebView experience.
 *
 * Usage:
 *   bun test              — run all tests headless
 *   bun test:ui           — open Playwright UI mode
 */

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  timeout: 30_000,

  use: {
    baseURL: process.env.BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Simulate Android WebView viewport
    viewport: { width: 393, height: 851 },
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    locale: "ar-EG",
    timezoneId: "Africa/Cairo",
    // RTL direction
    dir: "rtl",
  },

  projects: [
    {
      name: "chromium-android",
      use: {
        ...devices["Pixel 7"],
      },
    },
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: "bun run dev",
        port: 5173,
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
