import { expect, type Locator, type Page } from "@playwright/test";

export type ThemeMode = "light" | "dark";

type ContrastReport = {
  ratio: number;
  foreground: string;
  background: string;
  opacity: number;
  fontSize: string;
  fontWeight: string;
};

type InteractiveState = {
  backgroundColor: string;
  borderColor: string;
  boxShadow: string;
  color: string;
  outlineStyle: string;
  outlineWidth: string;
};

export async function signInWithE2EUser(page: Page) {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated readability coverage."
    );
  }

  await page.goto("/en/sign-in");
  await expect(page.getByRole("button", { name: /^sign in$/i })).toBeEnabled();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
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
}

export async function setOwnerMateTheme(page: Page, theme: ThemeMode) {
  await page.waitForFunction(() => document.readyState !== "loading");
  await page.waitForFunction(() => typeof window !== "undefined");

  await page.evaluate((nextTheme: ThemeMode) => {
    const ownerMateWindow = window as Window & {
      __OWNERMATE_THEME__?: {
        theme: ThemeMode | "system";
        setTheme: (theme: ThemeMode | "system") => void;
      };
    };

    ownerMateWindow.__OWNERMATE_THEME__?.setTheme(nextTheme);
    window.localStorage.setItem("ownermate-theme", nextTheme);

    if (!ownerMateWindow.__OWNERMATE_THEME__) {
      document.documentElement.classList.toggle("dark", nextTheme === "dark");
    }
  }, theme);

  await page.waitForFunction((nextTheme: ThemeMode) => {
    const ownerMateWindow = window as Window & {
      __OWNERMATE_THEME__?: {
        theme: ThemeMode | "system";
      };
    };
    const storedTheme = window.localStorage.getItem("ownermate-theme");
    const isDark = document.documentElement.classList.contains("dark");
    const handleTheme = ownerMateWindow.__OWNERMATE_THEME__?.theme;
    return (
      storedTheme === nextTheme &&
      (!handleTheme || handleTheme === nextTheme) &&
      (nextTheme === "dark" ? isDark : !isDark)
    );
  }, theme);
}

export async function expectMinimumContrast(
  locator: Locator,
  minRatio: number,
  description: string
) {
  await expect(locator, `${description} should be visible before checking contrast`).toBeVisible();
  const report = await getContrastReport(locator);
  expect(
    report.ratio,
    `${description} contrast ratio was ${report.ratio}: foreground ${report.foreground} on background ${report.background} at ${report.fontSize}/${report.fontWeight}`
  ).toBeGreaterThanOrEqual(minRatio);
  return report;
}

export async function getInteractiveState(locator: Locator) {
  return locator.evaluate<InteractiveState>((element) => {
    const styles = window.getComputedStyle(element as HTMLElement);
    return {
      backgroundColor: styles.backgroundColor,
      borderColor: styles.borderColor,
      boxShadow: styles.boxShadow,
      color: styles.color,
      outlineStyle: styles.outlineStyle,
      outlineWidth: styles.outlineWidth,
    };
  });
}

export function expectFocusIndicator(
  before: InteractiveState,
  after: InteractiveState,
  description: string
) {
  const outlineWidth = Number.parseFloat(after.outlineWidth) || 0;
  const hasVisibleFocus =
    outlineWidth > 0 ||
    before.boxShadow !== after.boxShadow ||
    before.outlineStyle !== after.outlineStyle ||
    before.borderColor !== after.borderColor;

  expect(hasVisibleFocus, `${description} should expose a visible focus state`).toBeTruthy();
}

export async function tabTo(page: Page, locator: Locator, maxTabs = 24) {
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press("Tab");
    if (await locator.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }

  throw new Error(`Unable to focus the target locator within ${maxTabs} Tab presses.`);
}

export async function expectNavItemIconAndLabelToMatch(locator: Locator) {
  const colors = await locator.evaluate((element) => {
    const spans = element.querySelectorAll("span");
    const iconContainer = spans.item(1) as HTMLElement | null;
    const label = spans.item(2) as HTMLElement | null;

    return {
      iconColor: iconContainer
        ? window.getComputedStyle(iconContainer).color
        : null,
      labelColor: label ? window.getComputedStyle(label).color : null,
    };
  });

  expect(colors.iconColor, "Navigation icon should expose a computed color").toBeTruthy();
  expect(colors.labelColor, "Navigation label should expose a computed color").toBeTruthy();
  expect(colors.iconColor).toBe(colors.labelColor);
}

export async function hoverAndAssertContrast(
  locator: Locator,
  minRatio: number,
  description: string
) {
  await locator.hover();
  await expectMinimumContrast(locator, minRatio, description);
}

export async function pressAndAssertContrast(
  page: Page,
  locator: Locator,
  minRatio: number,
  description: string
) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error(`Unable to calculate a bounding box for ${description}.`);
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  try {
    await expectMinimumContrast(locator, minRatio, description);
  } finally {
    await page.mouse.up();
  }
}

async function getContrastReport(locator: Locator) {
  return locator.evaluate<ContrastReport>((element) => {
    type Rgba = { r: number; g: number; b: number; a: number };

    const fallbackBackground: Rgba = { r: 255, g: 255, b: 255, a: 1 };

    const parseCssColor = (value: string): Rgba => {
      if (!value || value === "transparent") {
        return { r: 0, g: 0, b: 0, a: 0 };
      }

      const rgbMatch = value.match(/rgba?\(([^)]+)\)/i);
      if (!rgbMatch) {
        return { r: 0, g: 0, b: 0, a: 0 };
      }

      const channels = rgbMatch[1]
        .split(",")
        .map((channel) => Number.parseFloat(channel.trim()));

      return {
        r: channels[0] ?? 0,
        g: channels[1] ?? 0,
        b: channels[2] ?? 0,
        a: channels[3] ?? 1,
      };
    };

    const composite = (foreground: Rgba, background: Rgba): Rgba => {
      const alpha = foreground.a + background.a * (1 - foreground.a);

      if (alpha <= 0) {
        return { r: 0, g: 0, b: 0, a: 0 };
      }

      return {
        r:
          (foreground.r * foreground.a +
            background.r * background.a * (1 - foreground.a)) /
          alpha,
        g:
          (foreground.g * foreground.a +
            background.g * background.a * (1 - foreground.a)) /
          alpha,
        b:
          (foreground.b * foreground.a +
            background.b * background.a * (1 - foreground.a)) /
          alpha,
        a: alpha,
      };
    };

    const formatColor = (value: Rgba) =>
      `rgba(${Math.round(value.r)}, ${Math.round(value.g)}, ${Math.round(value.b)}, ${value.a.toFixed(2)})`;

    const channelToLinear = (channel: number) => {
      const normalized = channel / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };

    const getLuminance = (value: Rgba) =>
      0.2126 * channelToLinear(value.r) +
      0.7152 * channelToLinear(value.g) +
      0.0722 * channelToLinear(value.b);

    let resolvedBackground = parseCssColor(
      window.getComputedStyle(document.body).backgroundColor
    );

    let currentElement = element as HTMLElement | null;
    while (currentElement) {
      const nextBackground = parseCssColor(
        window.getComputedStyle(currentElement).backgroundColor
      );

      if (nextBackground.a > 0) {
        resolvedBackground = composite(nextBackground, resolvedBackground);
        if (resolvedBackground.a >= 0.99) {
          break;
        }
      }

      currentElement = currentElement.parentElement;
    }

    if (resolvedBackground.a < 0.99) {
      resolvedBackground = composite(resolvedBackground, fallbackBackground);
    }

    const styles = window.getComputedStyle(element as HTMLElement);
    const textColor = parseCssColor(styles.color);
    const resolvedTextColor =
      textColor.a >= 0.99
        ? textColor
        : composite(textColor, resolvedBackground);

    const foregroundLuminance = getLuminance(resolvedTextColor);
    const backgroundLuminance = getLuminance(resolvedBackground);
    const ratio =
      (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
      (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);

    return {
      ratio: Number(ratio.toFixed(2)),
      foreground: formatColor(resolvedTextColor),
      background: formatColor(resolvedBackground),
      opacity: Number(styles.opacity),
      fontSize: styles.fontSize,
      fontWeight: styles.fontWeight,
    };
  });
}
