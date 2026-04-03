"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { UserProfile } from "@/types/settings";

type ProfileContextValue = {
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
};

type ProfileProviderProps = {
  children: React.ReactNode;
  initialProfile: UserProfile;
};

const STORAGE_KEY = "ownermate-profile";
const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({
  children,
  initialProfile,
}: ProfileProviderProps) {
  const [profile, setProfile] = useState<UserProfile>(initialProfile);

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Partial<UserProfile>;
      const sameIdentity =
        typeof parsed.email === "string" && parsed.email === initialProfile.email;

      setProfile({
        ...initialProfile,
        fullName:
          sameIdentity && typeof parsed.fullName === "string"
            ? parsed.fullName
            : initialProfile.fullName,
        avatarUrl:
          typeof parsed.avatarUrl === "string"
            ? parsed.avatarUrl
            : initialProfile.avatarUrl,
      });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [initialProfile]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  const value = useMemo(
    () => ({
      profile,
      updateProfile: (patch: Partial<UserProfile>) => {
        setProfile((current) => ({ ...current, ...patch }));
      },
    }),
    [profile]
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);

  if (!context) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }

  return context;
}
