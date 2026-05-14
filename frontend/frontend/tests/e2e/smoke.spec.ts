import { expect, test } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test("sign-in page loads", async ({ page }) => {
  await page.goto("/en/sign-in");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
});

test.describe("authenticated smoke", () => {
  test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated smoke coverage.");

  test("user can sign in, view protected pages, and sign out", async ({ page }) => {
    await page.goto("/en/sign-in");
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeEnabled();
    await page.locator('input[name="email"]').fill(email ?? "");
    await page.locator('input[name="password"]').fill(password ?? "");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        return cookies.some((cookie) => cookie.name === "ownermate-access-token");
      })
      .toBeTruthy();
    await Promise.race([
      page.waitForURL(/\/en\/dashboard$/, { timeout: 15_000 }).catch(() => null),
      page
        .getByText(/reviews in scope/i)
        .first()
        .waitFor({ timeout: 15_000 }),
    ]);
    await expect(page.getByText(/reviews in scope/i).first()).toBeVisible();

    await page.getByRole("button", { name: /sign out/i }).click();
    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        return cookies.some((cookie) => cookie.name === "ownermate-access-token");
      })
      .toBeFalsy();
    await Promise.race([
      page.waitForURL(/\/en\/sign-in$/, { timeout: 15_000 }).catch(() => null),
      page.getByRole("heading", { name: /sign in/i }).waitFor({
        timeout: 15_000,
      }),
    ]);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });
});
