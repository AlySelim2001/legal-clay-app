# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Login & Authentication Flow >> login page renders with form elements
- Location: tests/e2e/auth.spec.ts:13:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=تسجيل الدخول')
Expected: visible
Error: strict mode violation: locator('text=تسجيل الدخول') resolved to 2 elements:
    1) <h2 class="text-lg font-bold text-foreground mb-1">تسجيل الدخول</h2> aka getByRole('heading', { name: 'تسجيل الدخول' })
    2) <button type="submit" class="clay-button w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">تسجيل الدخول</button> aka getByRole('button', { name: 'تسجيل الدخول' })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=تسجيل الدخول')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e7]:
    - generic [ref=e8]:
      - heading "CRIM-SYS 2026" [level=1] [ref=e16]
      - paragraph [ref=e17]: نظام إدارة القضايا الجنائية
    - generic [ref=e18]:
      - heading "تسجيل الدخول" [level=2] [ref=e19]
      - paragraph [ref=e20]: أدخل بياناتك للوصول إلى النظام
      - generic [ref=e21]:
        - generic [ref=e22]:
          - generic [ref=e23]: البريد الإلكتروني
          - textbox "example@crimsys.com" [ref=e24]
        - generic [ref=e25]:
          - generic [ref=e26]: كلمة المرور
          - generic [ref=e27]:
            - textbox "••••••••" [ref=e28]
            - button [ref=e29] [cursor=pointer]
        - generic [ref=e33]:
          - generic [ref=e34] [cursor=pointer]:
            - checkbox "تذكرني" [ref=e35]
            - generic [ref=e36]: تذكرني
          - link "نسيت كلمة المرور؟" [ref=e37] [cursor=pointer]:
            - /url: "#"
        - button "تسجيل الدخول" [ref=e38] [cursor=pointer]
    - paragraph [ref=e39]: © 2026 CRIM-SYS — جميع الحقوق محفوظة
  - region "Notifications alt+T"
```

# Test source

```ts
  1   | import { test, expect, waitForPageReady, expectRTL } from "./helpers";
  2   | 
  3   | test.describe("Login & Authentication Flow", () => {
  4   |   test("landing page renders with CRIM-SYS branding", async ({ page }) => {
  5   |     await page.goto("/", { waitUntil: "networkidle" });
  6   |     await waitForPageReady(page);
  7   | 
  8   |     // Page should render without crashing
  9   |     const body = page.locator("body");
  10  |     await expect(body).toBeVisible();
  11  |   });
  12  | 
  13  |   test("login page renders with form elements", async ({ page }) => {
  14  |     await page.goto("/login", { waitUntil: "networkidle" });
  15  |     await waitForPageReady(page);
  16  | 
  17  |     // Title
  18  |     await expect(page.locator("text=CRIM-SYS 2026")).toBeVisible();
  19  |     await expect(page.locator("text=نظام إدارة القضايا الجنائية")).toBeVisible();
  20  | 
  21  |     // Form fields
  22  |     await expect(page.locator('input[type="email"]')).toBeVisible();
  23  |     await expect(page.locator('input[type="password"]')).toBeVisible();
  24  | 
  25  |     // Submit button
  26  |     await expect(page.locator('button[type="submit"]')).toBeVisible();
> 27  |     await expect(page.locator("text=تسجيل الدخول")).toBeVisible();
      |                                                     ^ Error: expect(locator).toBeVisible() failed
  28  |   });
  29  | 
  30  |   test("login page has RTL layout", async ({ page }) => {
  31  |     await page.goto("/login", { waitUntil: "networkidle" });
  32  |     await waitForPageReady(page);
  33  |     await expectRTL(page);
  34  |   });
  35  | 
  36  |   test("login form shows validation for empty submission", async ({ page }) => {
  37  |     await page.goto("/login", { waitUntil: "networkidle" });
  38  |     await waitForPageReady(page);
  39  | 
  40  |     // Try submitting empty form
  41  |     const submitBtn = page.locator('button[type="submit"]');
  42  |     await submitBtn.click();
  43  | 
  44  |     // Email input should have validation (required attribute)
  45  |     const emailInput = page.locator('input[type="email"]');
  46  |     await expect(emailInput).toHaveAttribute("required", "");
  47  |   });
  48  | 
  49  |   test("password toggle button works", async ({ page }) => {
  50  |     await page.goto("/login", { waitUntil: "networkidle" });
  51  |     await waitForPageReady(page);
  52  | 
  53  |     const passwordInput = page.locator('input[type="password"]');
  54  |     await expect(passwordInput).toBeVisible();
  55  | 
  56  |     // Click toggle button (Eye icon)
  57  |     const toggleBtn = page.locator('input[type="password"]').locator("..").locator("button");
  58  |     await toggleBtn.click();
  59  | 
  60  |     // Should become text input
  61  |     const textInput = page.locator('input[type="text"]');
  62  |     await expect(textInput).toBeVisible();
  63  |   });
  64  | 
  65  |   test("remember me checkbox exists", async ({ page }) => {
  66  |     await page.goto("/login", { waitUntil: "networkidle" });
  67  |     await waitForPageReady(page);
  68  | 
  69  |     const checkbox = page.locator('input[type="checkbox"]');
  70  |     await expect(checkbox).toBeVisible();
  71  | 
  72  |     // Click it
  73  |     await checkbox.check();
  74  |     await expect(checkbox).toBeChecked();
  75  |   });
  76  | 
  77  |   test("unauthenticated user is redirected to /auth", async ({ page }) => {
  78  |     await page.goto("/app/dashboard", { waitUntil: "networkidle" });
  79  |     await waitForPageReady(page);
  80  | 
  81  |     // Should be redirected to auth page
  82  |     const url = page.url();
  83  |     expect(url).toContain("/auth");
  84  |   });
  85  | 
  86  |   test("auth page renders with email input and guest login", async ({ page }) => {
  87  |     await page.goto("/auth", { waitUntil: "networkidle" });
  88  |     await waitForPageReady(page);
  89  | 
  90  |     // Should have email input
  91  |     const emailInput = page.locator('input[name="email"]');
  92  |     await expect(emailInput).toBeVisible();
  93  | 
  94  |     // Guest login button
  95  |     await expect(page.locator("text=Continue as Guest")).toBeVisible();
  96  |   });
  97  | 
  98  |   test("login page has decorative elements", async ({ page }) => {
  99  |     await page.goto("/login", { waitUntil: "networkidle" });
  100 |     await waitForPageReady(page);
  101 | 
  102 |     // Gavel icon (in the logo card)
  103 |     await expect(page.locator(".text-primary").first()).toBeVisible();
  104 | 
  105 |     // Copyright text
  106 |     await expect(page.locator("text=© 2026 CRIM-SYS")).toBeVisible();
  107 |   });
  108 | 
  109 |   test("login form handles invalid credentials gracefully", async ({ page }) => {
  110 |     await page.goto("/login", { waitUntil: "networkidle" });
  111 |     await waitForPageReady(page);
  112 | 
  113 |     // Fill in invalid credentials
  114 |     await page.locator('input[type="email"]').fill("test@example.com");
  115 |     await page.locator('input[type="password"]').fill("wrongpassword");
  116 | 
  117 |     // Submit
  118 |     await page.locator('button[type="submit"]').click();
  119 | 
  120 |     // Wait for error or loading state
  121 |     await page.waitForTimeout(2_000);
  122 | 
  123 |     // Either error message appears or still on login page
  124 |     const url = page.url();
  125 |     expect(url).toContain("/login");
  126 |   });
  127 | 
```