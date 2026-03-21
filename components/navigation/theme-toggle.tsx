"use client";

import { useEffect, useMemo, useState } from "react";
import type { CommonDictionary } from "@/types/i18n";

type ThemeHandle = {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
};

type ThemeToggleProps = {
  common: CommonDictionary;
};

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.75V5.25M12 18.75V21.25M21.25 12H18.75M5.25 12H2.75M18.54 5.46L16.77 7.23M7.23 16.77L5.46 18.54M18.54 18.54L16.77 16.77M7.23 7.23L5.46 5.46"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20.1 14.16A8.5 8.5 0 0 1 9.84 3.9a8.75 8.75 0 1 0 10.26 10.26Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function getResolvedTheme(theme: ThemeHandle["theme"]) {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return theme;
}

export function ThemeToggle({ common }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeHandle["theme"]>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const handle = (window as Window & { __OWNERMATE_THEME__?: ThemeHandle })
      .__OWNERMATE_THEME__;
    const nextTheme = handle?.theme ?? "system";
    setTheme(nextTheme);
    setResolvedTheme(getResolvedTheme(nextTheme));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateResolvedTheme = () => {
      const currentTheme =
        (window as Window & { __OWNERMATE_THEME__?: ThemeHandle })
          .__OWNERMATE_THEME__?.theme ?? nextTheme;
      setResolvedTheme(getResolvedTheme(currentTheme));
    };

    media.addEventListener("change", updateResolvedTheme);
    return () => media.removeEventListener("change", updateResolvedTheme);
  }, []);

  const cycleTheme = () => {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
    const handle = (window as Window & { __OWNERMATE_THEME__?: ThemeHandle })
      .__OWNERMATE_THEME__;
    handle?.setTheme(nextTheme);
    setTheme(nextTheme);
    setResolvedTheme(nextTheme);
  };

  const label = useMemo(
    () =>
      resolvedTheme === "dark"
        ? `${common.theme}: ${common.dark}`
        : `${common.theme}: ${common.light}`,
    [common.dark, common.light, common.theme, resolvedTheme]
  );

  return (
    <button
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground transition hover:bg-surface"
      onClick={cycleTheme}
      title={label}
      type="button"
    >
      {resolvedTheme === "dark" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
