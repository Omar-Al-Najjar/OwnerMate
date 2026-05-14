"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useProfile } from "@/components/providers/profile-provider";
import { createBrowserSupabaseClient } from "@/lib/auth/supabase-browser";
import type { CommonDictionary } from "@/types/i18n";
import { cn } from "@/lib/utils/cn";
import type { Locale } from "@/lib/i18n/config";

type UserMenuProps = {
  common: CommonDictionary;
  isRtl: boolean;
  locale: Locale;
  pendingLabel: string;
  settingsLabel: string;
  signOutLabel: string;
};

type ThemeHandle = {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "OM";
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function UserMenu({
  common,
  isRtl,
  locale,
  pendingLabel,
  settingsLabel,
  signOutLabel,
}: UserMenuProps) {
  const { profile } = useProfile();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const initials = useMemo(() => getInitials(profile.fullName), [profile.fullName]);
  const settingsHref = `/${locale}/settings` as Route;
  const isArabicActive = locale === "ar";
  const isEnglishActive = locale === "en";
  const segments = pathname.split("/").filter(Boolean);
  const nextSearch = searchParams.toString();
  const englishPath = `/${["en", ...segments.slice(1)].join("/")}${nextSearch ? `?${nextSearch}` : ""}` as Route;
  const arabicPath = `/${["ar", ...segments.slice(1)].join("/")}${nextSearch ? `?${nextSearch}` : ""}` as Route;

  useEffect(() => {
    const getTheme = () => {
      const themeHandle = (window as Window & { __OWNERMATE_THEME__?: ThemeHandle })
        .__OWNERMATE_THEME__;
      const activeTheme = themeHandle?.theme ?? "system";
      if (activeTheme === "dark") {
        setResolvedTheme("dark");
        return;
      }
      if (activeTheme === "light") {
        setResolvedTheme("light");
        return;
      }
      setResolvedTheme(
        window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      );
    };

    getTheme();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", getTheme);
    return () => media.removeEventListener("change", getTheme);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleSignOut() {
    setIsPending(true);
    window.localStorage.removeItem("ownermate-profile");
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.replace(`/${locale}/sign-in`);
    }
  }

  const handleThemeChange = (nextTheme: "light" | "dark") => {
    const handle = (window as Window & { __OWNERMATE_THEME__?: ThemeHandle })
      .__OWNERMATE_THEME__;
    handle?.setTheme(nextTheme);
    setResolvedTheme(nextTheme);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={cn(
          "inline-flex min-h-11 items-center gap-3 rounded-full border border-border/70 bg-card/92 px-3.5 py-2 text-sm font-semibold text-foreground shadow-panel transition hover:border-primary/20 hover:bg-surface-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isRtl && "text-right"
        )}
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-xs font-bold tracking-[0.16em] text-white shadow-sm"
          dir="ltr"
        >
          {initials}
        </span>
        <span className="max-w-32 truncate" dir="auto">
          {profile.fullName}
        </span>
        <ChevronIcon isOpen={isOpen} />
      </button>

      <div
        aria-hidden={!isOpen}
        className={cn(
          "absolute top-full z-50 mt-3 w-80 origin-top rounded-2xl border border-border bg-surface-lowest p-2.5 shadow-2xl transition-all duration-200",
          isRtl ? "left-0" : "right-0",
          isOpen
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-1 scale-95 opacity-0"
        )}
        role="menu"
      >
        <div
          className={cn(
            "rounded-2xl border border-border/80 bg-surface-low px-4 py-3.5 shadow-sm",
            isRtl && "text-right"
          )}
        >
          <p className="truncate text-sm font-semibold text-foreground">
            <span dir="auto">{profile.fullName}</span>
          </p>
          <p className="mt-1 truncate text-xs text-foreground/80" dir="ltr">
            {profile.email}
          </p>
          <p
            className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-primary"
            dir="auto"
          >
            {profile.role}
          </p>
        </div>

        <div className="my-2 h-px bg-border/80" />

        <div className="space-y-1.5">
          <div
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl px-1.5 py-1.5",
              isRtl && "text-right"
            )}
          >
            <p className="text-xs font-medium text-muted">
              {common.language}
            </p>
            <div className="inline-grid h-8 grid-cols-2 rounded-lg border border-border/80 bg-surface-low p-0.5 shadow-sm">
              <Link
                aria-current={isEnglishActive ? "true" : undefined}
                className={cn(
                  "inline-flex h-full min-w-[72px] items-center justify-center rounded-md px-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-low",
                  isEnglishActive
                    ? "bg-surface-high text-foreground shadow-sm"
                    : "text-muted hover:bg-surface-high hover:text-foreground"
                )}
                href={englishPath}
                lang="en"
              >
                English
              </Link>
              <Link
                aria-current={isArabicActive ? "true" : undefined}
                className={cn(
                  "inline-flex h-full min-w-[72px] items-center justify-center rounded-md px-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-low",
                  isArabicActive
                    ? "bg-surface-high text-foreground shadow-sm"
                    : "text-muted hover:bg-surface-high hover:text-foreground"
                )}
                dir="rtl"
                href={arabicPath}
                lang="ar"
              >
                العربية
              </Link>
            </div>
          </div>

          <div
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border-t border-border/60 px-1.5 pt-2",
              isRtl && "text-right"
            )}
          >
            <p className="text-xs font-medium text-muted">
              {common.theme}
            </p>
            <div className="inline-grid h-8 grid-cols-2 rounded-lg border border-border/80 bg-surface-low p-0.5 shadow-sm">
              <button
                aria-pressed={resolvedTheme === "light"}
                className={cn(
                  "inline-flex h-full min-w-[72px] items-center justify-center rounded-md px-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-low",
                  resolvedTheme === "light"
                    ? "bg-surface-high text-foreground shadow-sm"
                    : "text-muted hover:bg-surface-high hover:text-foreground"
                )}
                onClick={() => handleThemeChange("light")}
                type="button"
              >
                {common.light}
              </button>
              <button
                aria-pressed={resolvedTheme === "dark"}
                className={cn(
                  "inline-flex h-full min-w-[72px] items-center justify-center rounded-md px-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-low",
                  resolvedTheme === "dark"
                    ? "bg-surface-high text-foreground shadow-sm"
                    : "text-muted hover:bg-surface-high hover:text-foreground"
                )}
                onClick={() => handleThemeChange("dark")}
                type="button"
              >
                {common.dark}
              </button>
            </div>
          </div>
        </div>

        <div className="my-2 h-px bg-border/80" />

        <div className="space-y-1">
          <Link
            className={cn(
              "flex min-h-11 items-center rounded-2xl px-4 text-sm font-medium text-foreground transition hover:bg-surface-high hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
              isRtl ? "text-right" : "text-left"
            )}
            href={settingsHref}
            onClick={() => setIsOpen(false)}
            role="menuitem"
          >
            <span>{settingsLabel}</span>
          </Link>

          <button
            className={cn(
              "flex min-h-11 w-full items-center rounded-2xl px-4 text-sm font-medium text-error transition hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
              isRtl ? "text-right" : "text-left"
            )}
            disabled={isPending}
            onClick={handleSignOut}
            role="menuitem"
            type="button"
          >
            <span>{isPending ? pendingLabel : signOutLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
