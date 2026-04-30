import "server-only";

import type {
  DashboardResponse,
  HealthResponse,
  ReadinessResponse,
  ReviewDetailResponse,
  ReviewsListRequest,
  ReviewsListResponse,
  SettingsResponse,
} from "@/lib/api/contracts";
import { toFrontendReview } from "@/lib/api/adapters";
import { getDisplayName } from "@/lib/auth/profile-display";
import { getAppSession } from "@/lib/auth/session";
import { getDashboardPayload } from "@/lib/dashboard/derive";
import {
  getDashboardData,
  getReviewById,
  getReviews,
  settingsProfile,
} from "@/lib/mock/data";

type BackendAuthSession = {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    language_preference: "en" | "ar" | null;
    theme_preference: "light" | "dark" | "system" | null;
  };
  businesses: Array<{
    id: string;
    name: string;
    owner_user_id: string;
    default_language: "en" | "ar" | null;
  }>;
  authenticated_at: string;
};

type BackendReviewRead = {
  id: string;
  business_id: string;
  source_type: string;
  reviewer_name: string | null;
  rating: number | null;
  language: string | null;
  review_text: string;
  review_created_at: string | null;
  status: "pending" | "reviewed" | "responded";
};

type BackendSentimentRead = {
  label: "positive" | "neutral" | "negative";
  confidence: number | null;
  summary_tags: string[] | null;
};

type BackendBusinessSettings = {
  id: string;
  name: string;
  google_review_business_name: string | null;
};

type BackendReviewWithSentimentRead = BackendReviewRead & {
  sentiment?: BackendSentimentRead | null;
};

type BackendDashboardOverview = {
  business_id: string;
  generated_at: string;
  sales_records: Array<{
    record_date: string;
    revenue: number;
    orders: number;
    refund_count: number;
    refund_value: number;
    channel_revenue: Record<string, number>;
    products: Array<{
      id: string;
      label: string;
      category: "signature_drinks" | "desserts" | "breakfast" | "bundles";
      revenue: number;
      units: number;
    }>;
  }>;
  capabilities: {
    review_data_available: boolean;
    sales_data_available: boolean;
    sales_data_note: string;
  };
};

function success<T>(data: T, source: "mock" | "backend" = "mock") {
  return {
    status: "success" as const,
    data,
    meta: {
      source,
      requestedAt: new Date().toISOString(),
    },
  };
}

function error(code: string, message: string, source: "mock" | "backend" = "backend") {
  return {
    status: "error" as const,
    error: {
      code,
      message,
    },
    meta: {
      source,
      requestedAt: new Date().toISOString(),
    },
  };
}

function getBackendBaseUrl() {
  return process.env.BACKEND_API_BASE_URL ?? "http://127.0.0.1:8000";
}

async function getProtectedHeaders() {
  const session = await getAppSession();
  const headers = new Headers();

  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  return { headers, session };
}

async function getBackendAuthContext() {
  const { headers, session } = await getProtectedHeaders();

  if (!headers.has("Authorization") || !session) {
    return { kind: "unauthenticated" as const };
  }

  const authSession = await getJson<BackendAuthSession>("/auth/me", { headers });
  if (authSession.status === "error") {
    return {
      kind: "error" as const,
      error: authSession.error ?? {
        code: "BACKEND_REQUEST_FAILED",
        message: "Backend request failed.",
      },
    };
  }

  if (!authSession.data) {
    return {
      kind: "error" as const,
      error: {
        code: "BACKEND_REQUEST_FAILED",
        message: "Backend request failed.",
      },
    };
  }

  return {
    kind: "ready" as const,
    headers,
    session,
    authSession: authSession.data,
    businessId: authSession.data.businesses[0]?.id ?? null,
  };
}

async function getJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${getBackendBaseUrl()}${path}`, {
    ...init,
    headers: init?.headers,
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as
    | {
        success?: boolean;
        data?: T;
        error?: { code?: string; message?: string };
      }
    | null;

  if (!response.ok || !body?.success) {
    return error(
      body?.error?.code ?? "BACKEND_REQUEST_FAILED",
      body?.error?.message ?? "Backend request failed."
    );
  }

  return success(body.data as T, "backend");
}

async function getBackendReviewsForBusiness(
  headers: Headers,
  businessId: string
) {
  const searchParams = new URLSearchParams({
    business_id: businessId,
    limit: "100",
  });

  const reviewsResponse = await getJson<BackendReviewWithSentimentRead[]>(
    `/reviews?${searchParams.toString()}`,
    {
      headers,
    }
  );

  if (reviewsResponse.status === "error") {
    return reviewsResponse;
  }

  if (!reviewsResponse.data) {
    return error("BACKEND_REQUEST_FAILED", "Backend request failed.");
  }

  return success(
    reviewsResponse.data.map((review) =>
      toFrontendReview(review, review.sentiment ?? null)
    ),
    "backend"
  );
}

export const apiClient = {
  async getDashboard(): Promise<DashboardResponse> {
    const authContext = await getBackendAuthContext();
    if (authContext.kind === "ready" && authContext.businessId) {
      const dashboardQuery = new URLSearchParams({
        business_id: authContext.businessId,
      });

      const overviewResponse = await getJson<BackendDashboardOverview>(
        `/dashboard/overview?${dashboardQuery.toString()}`,
        {
          headers: authContext.headers,
        }
      );

      if (overviewResponse.status === "error") {
        return error(
          overviewResponse.error?.code ?? "BACKEND_REQUEST_FAILED",
          overviewResponse.error?.message ?? "Backend request failed."
        );
      }

      if (!overviewResponse.data) {
        return error("BACKEND_REQUEST_FAILED", "Backend request failed.");
      }

      const reviewsResponse = await getBackendReviewsForBusiness(
        authContext.headers,
        authContext.businessId
      );

      if (reviewsResponse.status === "error") {
        return error(
          reviewsResponse.error?.code ?? "BACKEND_REQUEST_FAILED",
          reviewsResponse.error?.message ?? "Backend request failed."
        );
      }

      if (!reviewsResponse.data) {
        return error("BACKEND_REQUEST_FAILED", "Backend request failed.");
      }

      return success(
        getDashboardPayload(
          reviewsResponse.data,
          overviewResponse.data.sales_records.map((record) => ({
            date: `${record.record_date}T00:00:00.000Z`,
            revenue: record.revenue,
            orders: record.orders,
            refundCount: record.refund_count,
            refundValue: record.refund_value,
            channelRevenue: {
              walk_in: record.channel_revenue.walk_in ?? 0,
              delivery_app: record.channel_revenue.delivery_app ?? 0,
              instagram_dm: record.channel_revenue.instagram_dm ?? 0,
              whatsapp: record.channel_revenue.whatsapp ?? 0,
            },
            products: record.products,
          })),
          {
          reviewDataAvailable: overviewResponse.data.capabilities.review_data_available,
          salesDataAvailable: overviewResponse.data.capabilities.sales_data_available,
          salesDataNote: overviewResponse.data.capabilities.sales_data_note,
          }
        ),
        "backend"
      );
    }

    return success(getDashboardData());
  },
  async getReviews(request?: ReviewsListRequest): Promise<ReviewsListResponse> {
    const authContext = await getBackendAuthContext();
    if (authContext.kind === "ready" && authContext.businessId) {
      const reviewsResponse = await getBackendReviewsForBusiness(
        authContext.headers,
        authContext.businessId
      );

      if (reviewsResponse.status === "error") {
        return error(
          reviewsResponse.error?.code ?? "BACKEND_REQUEST_FAILED",
          reviewsResponse.error?.message ?? "Backend request failed."
        );
      }

      if (!reviewsResponse.data) {
        return error("BACKEND_REQUEST_FAILED", "Backend request failed.");
      }

      return success(
        {
          items: reviewsResponse.data,
          total: reviewsResponse.data.length,
        },
        "backend"
      );
    }

    const filtered = getReviews().filter((review) => {
      const queryMatch = request?.query
        ? `${review.reviewerName} ${review.reviewText}`
            .toLowerCase()
            .includes(request.query.toLowerCase())
        : true;
      const sentimentMatch =
        request?.sentiment && request.sentiment !== "all"
          ? review.sentiment.label === request.sentiment
          : true;
      const languageMatch =
        request?.language && request.language !== "all"
          ? review.language === request.language
          : true;

      return queryMatch && sentimentMatch && languageMatch;
    });

    return success({
      items: filtered,
      total: filtered.length,
    });
  },
  async getReviewById(reviewId: string): Promise<ReviewDetailResponse> {
    const authContext = await getBackendAuthContext();
    if (authContext.kind === "ready" && authContext.businessId) {
      const detailQuery = new URLSearchParams({
        business_id: authContext.businessId,
      });
      const reviewResponse = await getJson<BackendReviewWithSentimentRead>(
        `/reviews/${reviewId}?${detailQuery.toString()}`,
        {
          headers: authContext.headers,
        }
      );

      if (reviewResponse.status === "error") {
        return error(
          reviewResponse.error?.code ?? "BACKEND_REQUEST_FAILED",
          reviewResponse.error?.message ?? "Backend request failed."
        );
      }

      if (!reviewResponse.data) {
        return error("BACKEND_REQUEST_FAILED", "Backend request failed.");
      }

      return success(
        toFrontendReview(reviewResponse.data, reviewResponse.data.sentiment ?? null),
        "backend"
      );
    }

    const review = getReviewById(reviewId);

    if (!review) {
      return {
        status: "error",
        error: {
          code: "REVIEW_NOT_FOUND",
          message: "Review not found.",
        },
        meta: {
          source: "mock",
          requestedAt: new Date().toISOString(),
        },
      };
    }

    return success(review);
  },
  async getSettings(): Promise<SettingsResponse> {
    const authContext = await getBackendAuthContext();

    if (authContext.kind === "unauthenticated") {
      return success(settingsProfile);
    }

    if (authContext.kind === "error") {
      return error(authContext.error.code, authContext.error.message);
    }

    const response = await getJson<{
      language_preference: "en" | "ar" | null;
      theme_preference: "light" | "dark" | "system" | null;
      business: BackendBusinessSettings | null;
    }>("/settings", {
      headers: authContext.headers,
    });

    if (response.status === "error") {
      return error(
        response.error?.code ?? "BACKEND_REQUEST_FAILED",
        response.error?.message ?? "Backend request failed."
      );
    }

    if (!response.data) {
      return error("BACKEND_REQUEST_FAILED", "Backend request failed.");
    }

    return success(
      {
        locale: response.data.language_preference ?? settingsProfile.locale,
        theme: response.data.theme_preference ?? settingsProfile.theme,
        profile: {
          fullName: getDisplayName(
            authContext.session.fullName,
            authContext.session.email,
            settingsProfile.profile.fullName
          ),
          email: authContext.session.email,
          role:
            authContext.session.role.charAt(0).toUpperCase() +
            authContext.session.role.slice(1),
        },
        business: {
          id:
            response.data.business?.id ??
            authContext.businessId ??
            settingsProfile.business.id,
          name:
            response.data.business?.name ??
            authContext.authSession.businesses[0]?.name ??
            settingsProfile.business.name,
          googleReviewBusinessName:
            response.data.business?.google_review_business_name ??
            settingsProfile.business.googleReviewBusinessName,
        },
      },
      "backend"
    );
  },
  async getHealth(): Promise<HealthResponse> {
    return getJson("/health");
  },
  async getReadiness(): Promise<ReadinessResponse> {
    return getJson("/ready");
  },
};
