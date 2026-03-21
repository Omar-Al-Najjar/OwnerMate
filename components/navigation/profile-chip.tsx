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
      className={`inline-flex items-center gap-3 border border-border bg-card ${isRtl ? "flex-row-reverse" : "flex-row"} ${isSidebar ? "w-full rounded-2xl px-3 py-3" : "rounded-full px-2 py-1.5"}`}
    >
      <div
        className={`${isSidebar ? "h-11 w-11" : "h-9 w-9"} flex items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-xs font-semibold text-primary dark:bg-indigo-950/40 dark:text-indigo-200`}
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
          className={`${isSidebar ? "max-w-full" : "max-w-32 md:max-w-40"} truncate text-sm font-medium text-foreground`}
        >
          {profile.fullName}
        </p>
        {isSidebar ? (
          <p className="mt-0.5 truncate text-xs text-muted">{profile.email}</p>
        ) : null}
      </div>
    </div>
  );
}
