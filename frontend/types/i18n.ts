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

export type LanguageNamesDictionary = {
  en: string;
  ar: string;
};

export type StatusLabelsDictionary = {
  new: string;
  reviewed: string;
};

export type SentimentLabelsDictionary = {
  positive: string;
  neutral: string;
  negative: string;
};

export type AuthDictionary = {
  signIn: string;
  signUp: string;
  signInDescription: string;
  signUpDescription: string;
  signUpLink: string;
  signInLink: string;
  noAccount: string;
  haveAccount: string;
  email: string;
  password: string;
  fullName: string;
  signInButton: string;
  signUpButton: string;
  signOutButton: string;
  authActionPending: string;
  signInErrorFallback: string;
  signUpErrorFallback: string;
  signUpSuccessNotice: string;
};

export type DashboardDictionary = {
  title: string;
  description: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  totalReviews: string;
  averageRating: string;
  positiveShare: string;
  newReviews: string;
  activeSources: string;
  sentimentSummary: string;
  sentimentHelper: string;
  positive: string;
  neutral: string;
  negative: string;
  quickActions: string;
  quickActionsDescription: string;
  recentReviewsTitle: string;
  recentReviewsDescription: string;
  sentimentOverview: string;
  newReviewsHelper: string;
  sourcesHelper: string;
  loadingTitle: string;
  emptyTitle: string;
  errorTitle: string;
  loadingDescription: string;
  emptyDescription: string;
  errorDescription: string;
  filterSummary: string;
  focusWindow: string;
  allTime: string;
  last7Days: string;
  last30Days: string;
  sourceFilter: string;
  languageFilter: string;
  sentimentFilter: string;
  allSources: string;
  allLanguages: string;
  allSentiments: string;
  executiveSummary: string;
  executiveSummaryDescription: string;
  operationalPulse: string;
  operationalPulseDescription: string;
  priorityQueue: string;
  priorityQueueDescription: string;
  activityFeed: string;
  activityFeedDescription: string;
  ratingMix: string;
  sourceMix: string;
  languageMix: string;
  noPriorityTitle: string;
  noPriorityDescription: string;
  noActivityTitle: string;
  noActivityDescription: string;
  noReviewsInViewTitle: string;
  noReviewsInViewDescription: string;
  reviewVolume: string;
  clearFilters: string;
  reviewsInScope: string;
  positiveReviewsHelper: string;
  priorityHigh: string;
  priorityMedium: string;
  priorityLow: string;
  reasonNegativeLowRating: string;
  reasonUnreviewedNegative: string;
  reasonNewUnreviewed: string;
  reasonFollowUpNeeded: string;
  activityNewReview: string;
  activityNegativeAlert: string;
  activityReviewResolved: string;
  activityPositiveSignal: string;
  vsPreviousWindow: string;
  datasetBaseline: string;
  openReviewAction: string;
  openContentAction: string;
  jumpToReviewsAction: string;
  jumpToContentAction: string;
  activeNow: string;
};

export type LocaleParams = {
  params: Promise<{ locale: string }>;
};

export type ReviewDetailParams = {
  params: Promise<{ locale: string; reviewId: string }>;
};
