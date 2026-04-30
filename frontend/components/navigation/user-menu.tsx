"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useProfile } from "@/components/providers/profile-provider";
import { createBrowserSupabaseClient } from "@/lib/auth/supabase-browser";
import { cn } from "@/lib/utils/cn";
import type { Locale } from "@/lib/i18n/config";

type UserMenuProps = {
  isRtl: boolean;
  locale: Locale;
  pendingLabel: string;
  settingsLabel: string;
  signOutLabel: string;
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
  isRtl,
  locale,
  pendingLabel,
  settingsLabel,
  signOutLabel,
}: UserMenuProps) {
  const { profile } = useProfile();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const initials = useMemo(() => getInitials(profile.fullName), [profile.fullName]);
  const settingsHref = `/${locale}/settings` as Route;

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

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={cn(
          "inline-flex min-h-11 items-center gap-3 rounded-full border border-border/70 bg-card/92 px-3.5 py-2 text-sm font-semibold text-foreground shadow-panel transition hover:border-primary/20 hover:bg-surface-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isRtl && "flex-row-reverse text-right"
        )}
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-xs font-bold tracking-[0.16em] text-white shadow-sm">
          {initials}
        </span>
        <span className="max-w-32 truncate">{profile.fullName}</span>
        <ChevronIcon isOpen={isOpen} />
      </button>

      <div
        aria-hidden={!isOpen}
        className={cn(
          "absolute top-full z-50 mt-3 w-72 origin-top rounded-2xl border border-border bg-surface-lowest p-2.5 shadow-2xl transition-all duration-200",
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
            {profile.fullName}
          </p>
          <p className="mt-1 truncate text-xs text-foreground/80">{profile.email}</p>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">
            {profile.role}
          </p>
        </div>

        <div className="my-2.5 h-px bg-border" />

        <div className="space-y-1">
          <Link
            className={cn(
              "flex min-h-11 items-center rounded-2xl px-4 text-sm font-medium text-foreground transition hover:bg-surface-high hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
              isRtl ? "flex-row-reverse text-right" : "text-left"
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
              isRtl ? "flex-row-reverse text-right" : "text-left"
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
