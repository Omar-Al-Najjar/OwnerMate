import type { DashboardPayload } from "@/types/dashboard";
import type { GeneratedContentDraft, GenerationMode } from "@/types/content";
import type { Review } from "@/types/review";
import type { Locale, ThemePreference, UserProfile } from "@/types/settings";

export type ApiStatus = "idle" | "loading" | "success" | "error";

export type ApiResult<T> = {
  status: "success" | "error";
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta: {
    source: "mock" | "backend";
    requestedAt: string;
  };
};

export type ReviewsListRequest = {
  query?: string;
  sentiment?: Review["sentiment"]["label"] | "all";
  language?: Review["language"] | "all";
};

export type ReviewsListResponse = ApiResult<{
  items: Review[];
  total: number;
}>;

export type ReviewDetailResponse = ApiResult<Review>;

export type DashboardResponse = ApiResult<DashboardPayload>;

export type GenerateContentRequest = {
  mode: GenerationMode;
  language: Locale;
  businessContext: string;
};

export type GenerateContentResponse = ApiResult<GeneratedContentDraft>;

export type SettingsResponse = ApiResult<{
  locale: Locale;
  theme: ThemePreference;
  profile: UserProfile;
  business: {
    id: string;
    name: string;
    googleReviewBusinessName: string;
  };
}>;

export type HealthResponse = ApiResult<{
  status: string;
  environment: string;
  version: string;
}>;

export type ReadinessResponse = ApiResult<{
  status: string;
  environment: string;
  version: string;
  checks: Array<{
    name: string;
    status: string;
    configured: boolean;
    required: boolean;
    details?: Record<string, unknown> | null;
  }>;
}>;
