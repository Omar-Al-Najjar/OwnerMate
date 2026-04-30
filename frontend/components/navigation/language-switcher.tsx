"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import type { Locale } from "@/lib/i18n/config";
import type { CommonDictionary } from "@/types/i18n";

type LanguageSwitcherProps = {
  className?: string;
  common: CommonDictionary;
  locale: Locale;
};

export function LanguageSwitcher({
  className,
  common,
  locale,
}: LanguageSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const targetLocale = locale === "en" ? "ar" : "en";
  const segments = pathname.split("/").filter(Boolean);
  const nextPathname = `/${[targetLocale, ...segments.slice(1)].join("/")}`;
  const nextSearch = searchParams.toString();
  const nextPath = `${nextPathname}${nextSearch ? `?${nextSearch}` : ""}` as Route;

  return (
    <Link
      aria-label={common.switchLanguage}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-xl px-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-foreground transition hover:bg-card hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-low",
        className
      )}
      href={nextPath}
    >
      {targetLocale === "ar" ? "\u0627\u0644\u0639\u0631\u0628\u064A\u0629" : "English"}
    </Link>
  );
}
