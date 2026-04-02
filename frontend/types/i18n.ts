export type CommonDictionary = {
  theme: string;
  light: string;
  dark: string;
  system: string;
  language: string;
  openNavigation: string;
  closeNavigation: string;
  switchLanguage: string;
};

export type NavigationDictionary = {
  appName: string;
  frontendOnly: string;
  dashboard: string;
  reviews: string;
  aiContent: string;
  settings: string;
};

export type ShellDictionary = {
  dashboardDescription: string;
  reviewsDescription: string;
  aiContentDescription: string;
  settingsDescription: string;
};

export type LocaleParams = {
  params: Promise<{ locale: string }>;
};

export type ReviewDetailParams = {
  params: Promise<{ locale: string; reviewId: string }>;
};
