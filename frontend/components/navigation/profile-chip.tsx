"use client";

import { useMemo } from "react";
import { useProfile } from "@/components/providers/profile-provider";

type ProfileChipProps = {
  isRtl: boolean;
  variant?: "default" | "sidebar";
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "OM";
}

export function ProfileChip({ isRtl, variant = "default" }: ProfileChipProps) {
  const { profile } = useProfile();
  const initials = useMemo(
    () => getInitials(profile.fullName),
    [profile.fullName]
  );
  const isSidebar = variant === "sidebar";

  return (
    <div
      className={`inline-flex items-center gap-3 ${isRtl ? "flex-row-reverse" : "flex-row"} ${
        isSidebar
          ? "w-full rounded-2xl bg-sidebar-surface px-3 py-3.5 text-sidebar-foreground ring-1 ring-inset ring-sidebar-border/80"
          : "rounded-2xl bg-surface-low px-2.5 py-2 ring-1 ring-inset ring-border/70"
      }`}
    >
      <div
        className={`${isSidebar ? "h-11 w-11" : "h-10 w-10"} flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-sidebar to-primary-container text-xs font-semibold tracking-[0.14em] text-white shadow-panel`}
      >
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={profile.fullName}
            className="h-full w-full object-cover"
            src={profile.avatarUrl}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      <div className={`min-w-0 ${isRtl ? "text-right" : "text-left"}`}>
        <p
          className={`${isSidebar ? "max-w-full text-sidebar-foreground" : "max-w-36 md:max-w-40 text-foreground"} truncate text-sm font-semibold`}
        >
          {profile.fullName}
        </p>
        <p
          className={`mt-0.5 truncate text-xs ${
            isSidebar ? "text-sidebar-muted" : "text-muted"
          }`}
        >
          {isSidebar ? profile.email : profile.role}
        </p>
      </div>
    </div>
  );
}
