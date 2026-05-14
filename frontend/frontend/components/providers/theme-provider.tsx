"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/config";

type ThemeMode = "light" | "dark" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  dictionary: {
    theme: string;
    light: string;
    dark: string;
    system: string;
  };
  dir: "ltr" | "rtl";
  locale: Locale;
};

const STORAGE_KEY = "ownermate-theme";

function resolveTheme(mode: ThemeMode) {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return mode;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  dir,
  locale,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return defaultTheme;
    }

    const storedTheme = window.localStorage.getItem(
      STORAGE_KEY
    ) as ThemeMode | null;
    return storedTheme ?? defaultTheme;
  });

  useEffect(() => {
    const resolvedTheme = resolveTheme(theme);
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.documentElement.style.colorScheme = resolvedTheme;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [dir, locale, theme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const resolvedTheme = resolveTheme(theme);
      document.documentElement.style.colorScheme = resolvedTheme;
      document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    };

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, theme);
    (
      window as Window & {
        __OWNERMATE_THEME__?: {
          theme: ThemeMode;
          setTheme: (theme: ThemeMode) => void;
        };
      }
    ).__OWNERMATE_THEME__ = {
      theme,
      setTheme,
    };
  }, [theme]);

  return <>{children}</>;
}
