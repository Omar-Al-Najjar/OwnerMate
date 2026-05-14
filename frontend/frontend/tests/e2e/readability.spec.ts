import { expect, test } from "@playwright/test";
import {
  expectFocusIndicator,
  expectMinimumContrast,
  expectNavItemIconAndLabelToMatch,
  getInteractiveState,
  hoverAndAssertContrast,
  pressAndAssertContrast,
  setOwnerMateTheme,
  signInWithE2EUser,
  tabTo,
  type ThemeMode,
} from "./utils/ownerMate-ui";

const THEMES: ThemeMode[] = ["light", "dark"];
const hasAuthCredentials = Boolean(
  process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD
);

for (const theme of THEMES) {
  test(`sign-in form keeps readable controls in ${theme} mode`, async ({
    page,
  }) => {
    await page.goto("/en/sign-in");
    await setOwnerMateTheme(page, theme);

    const emailLabel = page.getByText(/^email$/i);
    const passwordLabel = page.getByText(/^password$/i);
    const emailInput = page.getByLabel(/^email$/i);
    const passwordInput = page.getByLabel(/^password$/i);
    const signInButton = page.getByRole("button", { name: /sign in/i });

    await expectMinimumContrast(emailLabel, 4.5, "Sign-in email label");
    await expectMinimumContrast(passwordLabel, 4.5, "Sign-in password label");
    await expectMinimumContrast(emailInput, 4.5, "Sign-in email input");
    await expectMinimumContrast(passwordInput, 4.5, "Sign-in password input");
    await expectMinimumContrast(signInButton, 4.5, "Sign-in submit button");

    const emailBeforeFocus = await getInteractiveState(emailInput);
    await tabTo(page, emailInput, 12);
    await expect(emailInput).toBeFocused();
    const emailAfterFocus = await getInteractiveState(emailInput);
    expectFocusIndicator(
      emailBeforeFocus,
      emailAfterFocus,
      "Sign-in email input"
    );

    const passwordBeforeFocus = await getInteractiveState(passwordInput);
    await tabTo(page, passwordInput, 12);
    await expect(passwordInput).toBeFocused();
    const passwordAfterFocus = await getInteractiveState(passwordInput);
    expectFocusIndicator(
      passwordBeforeFocus,
      passwordAfterFocus,
      "Sign-in password input"
    );

    const buttonBeforeFocus = await getInteractiveState(signInButton);
    await tabTo(page, signInButton, 16);
    await expect(signInButton).toBeFocused();
    const buttonAfterFocus = await getInteractiveState(signInButton);
    expectFocusIndicator(
      buttonBeforeFocus,
      buttonAfterFocus,
      "Sign-in submit button"
    );

    await hoverAndAssertContrast(
      signInButton,
      4.5,
      "Hovered sign-in submit button"
    );
    await pressAndAssertContrast(
      page,
      signInButton,
      4.5,
      "Pressed sign-in submit button"
    );
  });
}

test("Arabic sign-in preserves RTL readability", async ({ page }) => {
  await page.goto("/ar/sign-in");
  await setOwnerMateTheme(page, "dark");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");

  const firstLabel = page.locator("label").first();
  const firstInput = page.locator("input").first();
  const submitButton = page.getByRole("button", { name: /تسجيل الدخول/i });

  await expectMinimumContrast(firstLabel, 4.5, "Arabic sign-in form label");
  await expectMinimumContrast(firstInput, 4.5, "Arabic sign-in input");
  await expectMinimumContrast(
    submitButton,
    4.5,
    "Arabic sign-in submit button"
  );
});

for (const theme of THEMES) {
  test(`dashboard shell stays readable in ${theme} mode`, async ({ page }) => {
    test.skip(
      !hasAuthCredentials,
      "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated readability coverage."
    );

    await signInWithE2EUser(page);
    await setOwnerMateTheme(page, theme);

    const currentNav = page.locator("aside a[aria-current='page']").first();
    const reviewsNav = page.locator("aside").getByRole("link", {
      name: /^reviews$/i,
    });
    const themeToggle = page.getByRole("button", { name: /theme/i });
    const goToReviewsLink = page
      .locator("main")
      .getByRole("link", { name: /go to reviews/i });
    const rangeButton = page.getByRole("button", { name: /last 7 days/i });
    const summaryCopy = page.getByText(/reviews in scope/i).first();

    await expect(currentNav).toContainText(/dashboard/i);
    await expectMinimumContrast(currentNav, 4.5, "Current dashboard nav item");
    await expectNavItemIconAndLabelToMatch(currentNav);

    await expectMinimumContrast(reviewsNav, 4.5, "Inactive reviews nav item");
    await hoverAndAssertContrast(
      reviewsNav,
      4.5,
      "Hovered inactive reviews nav item"
    );
    await expectNavItemIconAndLabelToMatch(reviewsNav);

    const currentNavBeforeFocus = await getInteractiveState(currentNav);
    await tabTo(page, currentNav, 12);
    await expect(currentNav).toBeFocused();
    const currentNavAfterFocus = await getInteractiveState(currentNav);
    expectFocusIndicator(
      currentNavBeforeFocus,
      currentNavAfterFocus,
      "Current dashboard nav item"
    );

    const themeToggleBeforeFocus = await getInteractiveState(themeToggle);
    await tabTo(page, themeToggle, 20);
    await expect(themeToggle).toBeFocused();
    const themeToggleAfterFocus = await getInteractiveState(themeToggle);
    expectFocusIndicator(
      themeToggleBeforeFocus,
      themeToggleAfterFocus,
      "Theme toggle button"
    );
    await expectMinimumContrast(themeToggle, 4.5, "Theme toggle button");

    const alternateTheme = theme === "light" ? "dark" : "light";
    await themeToggle.click();
    await page.waitForFunction(
      (expectedTheme: ThemeMode) =>
        expectedTheme === "dark"
          ? document.documentElement.classList.contains("dark")
          : !document.documentElement.classList.contains("dark"),
      alternateTheme
    );
    await expectMinimumContrast(
      themeToggle,
      4.5,
      "Theme toggle after switching theme"
    );
    await setOwnerMateTheme(page, theme);

    await expectMinimumContrast(summaryCopy, 4.5, "Dashboard summary copy");
    await expectMinimumContrast(goToReviewsLink, 4.5, "Dashboard CTA link");
    await hoverAndAssertContrast(
      goToReviewsLink,
      4.5,
      "Hovered dashboard CTA link"
    );
    await expectMinimumContrast(rangeButton, 4.5, "Dashboard range filter");
    await hoverAndAssertContrast(
      rangeButton,
      4.5,
      "Hovered dashboard range filter"
    );
  });
}

for (const theme of THEMES) {
  test(`form-heavy app surfaces stay readable in ${theme} mode`, async ({
    page,
  }) => {
    test.skip(
      !hasAuthCredentials,
      "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated readability coverage."
    );

    await signInWithE2EUser(page);
    await setOwnerMateTheme(page, theme);

    await page.goto("/en/reviews");
    await expect(page.getByRole("heading", { name: /reviews/i })).toBeVisible();

    const searchInput = page.getByLabel(/^search$/i);
    const sentimentSelect = page.getByLabel(/^sentiment$/i);
    const clearButton = page.getByRole("button", { name: /^clear$/i });
    const openReviewLink = page
      .locator("main")
      .getByRole("link", { name: /open review/i })
      .first();

    await expect(clearButton).toBeDisabled();
    await expectMinimumContrast(searchInput, 4.5, "Reviews search input");
    await expectMinimumContrast(sentimentSelect, 4.5, "Reviews sentiment filter");
    await expectMinimumContrast(
      clearButton,
      3,
      "Disabled reviews clear button"
    );

    const searchBeforeFocus = await getInteractiveState(searchInput);
    await tabTo(page, searchInput, 28);
    await expect(searchInput).toBeFocused();
    const searchAfterFocus = await getInteractiveState(searchInput);
    expectFocusIndicator(
      searchBeforeFocus,
      searchAfterFocus,
      "Reviews search input"
    );

    await hoverAndAssertContrast(
      sentimentSelect,
      4.5,
      "Hovered reviews sentiment filter"
    );
    await searchInput.fill("service");
    await expect(clearButton).toBeEnabled();
    await expectMinimumContrast(clearButton, 4.5, "Enabled reviews clear button");
    await hoverAndAssertContrast(
      clearButton,
      4.5,
      "Hovered reviews clear button"
    );
    await expectMinimumContrast(openReviewLink, 4.5, "Reviews table detail link");
    await hoverAndAssertContrast(
      openReviewLink,
      4.5,
      "Hovered reviews table detail link"
    );

    await page.goto("/en/settings");
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();

    const googleBusinessInput = page.getByLabel(/google business name/i);
    const importGoogleReviewsButton = page.getByRole("button", {
      name: /import google reviews/i,
    });
    const discardButton = page.getByRole("button", { name: /discard/i });
    const saveChangesButton = page.getByRole("button", { name: /save changes/i });

    await expectMinimumContrast(
      googleBusinessInput,
      4.5,
      "Settings Google business name input"
    );
    await expectMinimumContrast(
      importGoogleReviewsButton,
      4.5,
      "Settings Google import button"
    );
    await hoverAndAssertContrast(
      importGoogleReviewsButton,
      4.5,
      "Hovered settings Google import button"
    );
    await expectMinimumContrast(discardButton, 4.5, "Settings discard button");
    await hoverAndAssertContrast(
      discardButton,
      4.5,
      "Hovered settings discard button"
    );
    await expectMinimumContrast(
      saveChangesButton,
      4.5,
      "Settings save changes button"
    );

  });
}

test.describe("mobile shell readability", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const theme of THEMES) {
    test(`mobile navigation controls stay readable in ${theme} mode`, async ({
      page,
    }) => {
      test.skip(
        !hasAuthCredentials,
        "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated readability coverage."
      );

      await signInWithE2EUser(page);
      await setOwnerMateTheme(page, theme);

      const mobileMenuButton = page.getByRole("button", {
        name: /open navigation/i,
      });
      const mobileMenuBeforeFocus = await getInteractiveState(mobileMenuButton);

      await page.keyboard.press("Tab");
      await expect(mobileMenuButton).toBeFocused();
      const mobileMenuAfterFocus = await getInteractiveState(mobileMenuButton);
      expectFocusIndicator(
        mobileMenuBeforeFocus,
        mobileMenuAfterFocus,
        "Mobile navigation toggle"
      );
      await expectMinimumContrast(
        mobileMenuButton,
        4.5,
        "Mobile navigation toggle"
      );

      await mobileMenuButton.press("Enter");

      const closeNavigationButton = page.getByRole("button", {
        name: /close navigation/i,
      });
      const activeNav = page.locator("aside a[aria-current='page']").first();

      await expect(closeNavigationButton).toBeVisible();
      await expect(activeNav).toBeVisible();
      await expectMinimumContrast(
        closeNavigationButton,
        4.5,
        "Mobile close navigation button"
      );
      await expectMinimumContrast(
        activeNav,
        4.5,
        "Mobile active navigation item"
      );
      await expectNavItemIconAndLabelToMatch(activeNav);
    });
  }
});
