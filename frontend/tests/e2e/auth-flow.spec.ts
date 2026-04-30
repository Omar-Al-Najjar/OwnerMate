import { expect, test } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test("empty sign-in submission shows clear validation errors", async ({
  page,
}) => {
  await page.goto("/en/sign-in");
  const signInButton = page.getByRole("button", { name: /^sign in$/i });

  await expect(signInButton).toBeEnabled();
  await signInButton.click();

  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Enter your password to continue.")).toBeVisible();
  await expect(page).toHaveURL(/\/en\/sign-in$/);
});

test("forgot password explains when email is missing", async ({ page }) => {
  await page.goto("/en/sign-in");
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeEnabled();
  await page.getByRole("button", { name: /forgot password/i }).click();

  await expect(
    page.getByText("Enter a valid email before requesting a reset.")
  ).toBeVisible();
});

test("wrong password shows a clear credentials error", async ({ page }) => {
  test.skip(!email, "Set E2E_USER_EMAIL to exercise wrong-password coverage.");

  await page.goto("/en/sign-in");
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeEnabled();
  await page.locator('input[name="email"]').fill(email ?? "");
  await page.locator('input[name="password"]').fill("definitely-wrong-password");
  await page.getByRole("button", { name: /^sign in$/i }).click();

  await expect(
    page.getByText("Incorrect email or password. Check your details and try again.")
  ).toBeVisible();
  await expect(page).toHaveURL(/\/en\/sign-in$/);
});
