export type Locale = "en" | "ar";
export type ThemePreference = "light" | "dark" | "system";

export type UserProfile = {
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string;
};

export type SettingsPayload = {
  locale: Locale;
  theme: ThemePreference;
  profile: UserProfile;
};
