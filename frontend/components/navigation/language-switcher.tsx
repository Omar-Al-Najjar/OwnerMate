"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";
import type { CommonDictionary } from "@/types/i18n";

type LanguageSwitcherProps = {
  common: CommonDictionary;
  locale: Locale;
};

export function LanguageSwitcher({ common, locale }: LanguageSwitcherProps) {
  const pathname = usePathname();
  const targetLocale = locale === "en" ? "ar" : "en";
  const segments = pathname.split("/").filter(Boolean);
  const nextPath =
    `/${[targetLocale, ...segments.slice(1)].join("/")}` as Route;

  return (
    <Link
      aria-label={common.switchLanguage}
      className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-sm font-medium text-foreground transition hover:bg-surface"
      href={nextPath}
    >
      {targetLocale === "ar"
        ? "\u0627\u0644\u0639\u0631\u0628\u064A\u0629"
        : "English"}
    </Link>
  );
}
