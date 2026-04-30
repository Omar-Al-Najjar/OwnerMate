"use client";

import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type NavIconKey =
  | "dashboard"
  | "reviews"
  | "dataset-analysis"
  | "settings";

type NavItemProps = {
  active: boolean;
  href: Route;
  icon: NavIconKey;
  isRtl: boolean;
  label: string;
  onNavigate?: () => void;
};

function NavIcon({ icon }: { icon: NavIconKey }) {
  if (icon === "dashboard") {
    return (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M4 4H10V10H4V4ZM14 4H20V10H14V4ZM4 14H10V20H4V14ZM14 14H20V20H14V14Z" />
      </svg>
    );
  }

  if (icon === "reviews") {
    return (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M5 4.75H19C19.41 4.75 19.75 5.09 19.75 5.5V15.5C19.75 15.91 19.41 16.25 19 16.25H10.56L6.25 19.75V16.25H5C4.59 16.25 4.25 15.91 4.25 15.5V5.5C4.25 5.09 4.59 4.75 5 4.75Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M9.25 12.75L14.92 7.08L16.92 9.08L11.25 14.75H9.25V12.75Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (icon === "dataset-analysis") {
    return (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M5.25 5.5C5.25 4.81 5.81 4.25 6.5 4.25H17.5C18.19 4.25 18.75 4.81 18.75 5.5V18.5C18.75 19.19 18.19 19.75 17.5 19.75H6.5C5.81 19.75 5.25 19.19 5.25 18.5V5.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M8 15.5L10.6 12.9L12.45 14.75L16 11.2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M8 8.5H16"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M10.31 3.52C11.08 2.16 12.92 2.16 13.69 3.52L14.25 4.5L15.37 4.36C16.92 4.17 18.21 5.46 18.02 7.01L17.88 8.13L18.86 8.69C20.22 9.46 20.22 11.3 18.86 12.07L17.88 12.63L18.02 13.75C18.21 15.3 16.92 16.59 15.37 16.4L14.25 16.26L13.69 17.24C12.92 18.6 11.08 18.6 10.31 17.24L9.75 16.26L8.63 16.4C7.08 16.59 5.79 15.3 5.98 13.75L6.12 12.63L5.14 12.07C3.78 11.3 3.78 9.46 5.14 8.69L6.12 8.13L5.98 7.01C5.79 5.46 7.08 4.17 8.63 4.36L9.75 4.5L10.31 3.52ZM12 8.25C10.48 8.25 9.25 9.48 9.25 11C9.25 12.52 10.48 13.75 12 13.75C13.52 13.75 14.75 12.52 14.75 11C14.75 9.48 13.52 8.25 12 8.25Z" />
    </svg>
  );
}

export function NavItem({
  active,
  href,
  icon,
  isRtl,
  label,
  onNavigate,
}: NavItemProps) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-3 text-sm font-semibold tracking-[-0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
        isRtl ? "flex-row-reverse text-right" : "text-left",
        active
          ? "bg-primary/12 text-sidebar-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_30px_-24px_rgba(0,83,219,0.28)] ring-1 ring-inset ring-primary/20"
          : "text-sidebar-muted hover:bg-sidebar-surface-hover hover:text-sidebar-foreground"
      )}
      href={href}
      onClick={onNavigate}
    >
      <span
        className={cn(
          "absolute inset-y-2 w-0.5 rounded-full transition",
          isRtl ? "right-2" : "left-2",
          active ? "bg-primary" : "bg-transparent group-hover:bg-white/20"
        )}
      />
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition",
          active
            ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/20"
            : "bg-sidebar-surface text-sidebar-muted group-hover:bg-sidebar-surface group-hover:text-sidebar-foreground"
        )}
      >
        <NavIcon icon={icon} />
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
