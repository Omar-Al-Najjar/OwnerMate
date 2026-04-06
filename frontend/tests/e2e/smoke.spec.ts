import { expect, test } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test("sign-in page loads", async ({ page }) => {
  await page.goto("/en/sign-in");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
});

test.describe("authenticated smoke", () => {
  test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated smoke coverage.");

  test("user can sign in, view protected pages, and sign out", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel(/email/i).fill(email ?? "");
    await page.getByLabel(/password/i).fill(password ?? "");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await expect(page.getByText(/reviews in scope/i)).toBeVisible();

    await page.goto("/en/reviews");
    await expect(page.getByRole("heading", { name: /reviews/i })).toBeVisible();

    await page.goto("/en/settings");
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();

    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/en\/sign-in$/);
  });
});
