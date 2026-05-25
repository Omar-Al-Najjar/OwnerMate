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
import {
  formatSourceLabel,
  normalizeLanguage,
  normalizeStatus,
  toFrontendReviewListItem,
  toFrontendReview,
} from "@/lib/api/adapters";
import { getDisplayName } from "@/lib/auth/profile-display";
import { getAppSession } from "@/lib/auth/session";
import {
  DEFAULT_DASHBOARD_FILTERS,
  getDashboardPayloadFromOverview,
} from "@/lib/dashboard/derive";
import {
  getDashboardData,
  getReviewById,
  getReviews,
  settingsProfile,
} from "@/lib/mock/data";
import type {
  DashboardComparison,
  DashboardComparisonMetric,
  DashboardDistributionBucket,
  DashboardFilters,
  DashboardMetricSummary,
  DashboardOverviewData,
  DashboardPriorityReview,
  DashboardReviewTimeSeriesPoint,
  DashboardSalesSummary,
  SalesRecord,
} from "@/types/dashboard";
import type {
  Review,
  ReviewListItem,
  ReviewLanguage,
  ReviewStatus,
  SentimentLabel,
} from "@/types/review";

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

const BACKEND_GET_CACHE_TTL_MS = 60_000;
const backendGetCache = new Map<
  string,
  {
    expiresAt: number;
    value: unknown;
  }
>();

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

type BackendReviewListItemRead = BackendReviewRead & {
  sentiment?: {
    label: "positive" | "neutral" | "negative";
  } | null;
};

type BackendReviewsListPayload = {
  items: BackendReviewListItemRead[];
  total: number;
  limit: number;
  offset: number;
  source_types: string[];
};

type BackendDashboardOverview = {
  business_id: string;
  generated_at: string;
  metrics: {
    total_reviews: number;
    average_rating: number | null;
    positive_share: number;
    negative_share: number;
    pending_reviews: number;
    reviewed_reviews: number;
    responded_reviews: number;
    active_sources: number;
  };
  distributions: {
    sentiment: Array<{
      label: string;
      value: number;
      share: number;
    }>;
    ratings: Array<{
      label: string;
      value: number;
      share: number;
    }>;
    sources: Array<{
      label: string;
      value: number;
      share: number;
    }>;
    languages: Array<{
      label: string;
      value: number;
      share: number;
    }>;
  };
  recent_reviews: Array<{
    review_id: string;
    source_type: string;
    reviewer_name: string | null;
    rating: number | null;
    language: string | null;
    review_text: string;
    review_created_at: string | null;
    status: "pending" | "reviewed" | "responded";
    sentiment_label: "positive" | "neutral" | "negative" | null;
    sentiment_confidence: number | null;
    summary_tags: string[];
  }>;
  priority_reviews: Array<{
    review_id: string;
    source_type: string;
    reviewer_name: string | null;
    rating: number | null;
    language: string | null;
    review_text: string;
    review_created_at: string | null;
    status: "pending" | "reviewed" | "responded";
    sentiment_label: "positive" | "neutral" | "negative" | null;
    sentiment_confidence: number | null;
    summary_tags: string[];
    priority: "high" | "medium" | "low";
    reason:
      | "negative_low_rating"
      | "unreviewed_negative"
      | "new_unreviewed"
      | "follow_up_needed";
  }>;
  activity_feed: Array<{
    review_id: string;
    type: "new_review" | "negative_alert" | "review_resolved" | "positive_signal";
    occurred_at: string | null;
    source_type: string;
    rating: number | null;
    language: string | null;
    status: "pending" | "reviewed" | "responded";
    sentiment_label: "positive" | "neutral" | "negative" | null;
    reviewer_name: string | null;
  }>;
  filter_options: {
    sources: string[];
    languages: string[];
    sentiments: Array<"positive" | "neutral" | "negative">;
  };
  review_timeseries: Array<{
    date: string;
    total_reviews: number;
    positive_reviews: number;
    positive_share: number;
  }>;
  comparison: {
    total_reviews: BackendDashboardComparisonMetric;
    average_rating: BackendDashboardComparisonMetric;
    positive_share: BackendDashboardComparisonMetric;
    negative_share: BackendDashboardComparisonMetric;
    pending_reviews: BackendDashboardComparisonMetric;
    reviewed_reviews: BackendDashboardComparisonMetric;
    responded_reviews: BackendDashboardComparisonMetric;
    active_sources: BackendDashboardComparisonMetric;
    total_revenue: BackendDashboardComparisonMetric;
    total_orders: BackendDashboardComparisonMetric;
    average_order_value: BackendDashboardComparisonMetric;
    refund_count: BackendDashboardComparisonMetric;
    refund_value: BackendDashboardComparisonMetric;
    refund_rate: BackendDashboardComparisonMetric;
  };
  sales_summary: {
    total_revenue: number;
    total_orders: number;
    average_order_value: number;
    refund_count: number;
    refund_value: number;
    refund_rate: number;
  };
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

type BackendDashboardComparisonMetric = {
  current: number | null;
  previous: number | null;
  delta: number | null;
  percentage_change: number | null;
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

function getBackendCacheKey(path: string, init?: RequestInit) {
  const method = init?.method ?? "GET";
  if (method.toUpperCase() !== "GET") {
    return null;
  }

  const headers = init?.headers instanceof Headers ? init.headers : null;
  const authorization = headers?.get("Authorization") ?? "";
  return `${authorization}:${path}`;
}

async function getProtectedHeaders() {
  const session = await getAppSession();
  const headers = new Headers();

  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  return { headers, session };
}

async function getBackendAuthContext(options?: {
  requireBackendSession?: boolean;
}) {
  const { headers, session } = await getProtectedHeaders();

  if (!headers.has("Authorization") || !session) {
    return { kind: "unauthenticated" as const };
  }

  if (!options?.requireBackendSession && session.businessId) {
    return {
      kind: "ready" as const,
      headers,
      session,
      authSession: null,
      businessId: session.businessId,
    };
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
  const cacheKey = getBackendCacheKey(path, init);
  if (cacheKey) {
    const cached = backendGetCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return success(cached.value as T, "backend");
    }
  }

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

  if (cacheKey) {
    backendGetCache.set(cacheKey, {
      expiresAt: Date.now() + BACKEND_GET_CACHE_TTL_MS,
      value: body.data as T,
    });
  }

  return success(body.data as T, "backend");
}

async function getBackendReviewsForBusiness(
  headers: Headers,
  businessId: string,
  request?: ReviewsListRequest
) {
  const searchParams = new URLSearchParams({
    business_id: businessId,
    limit: String(request?.pageSize ?? 10),
    offset: String(
      Math.max(0, ((request?.page ?? 1) - 1) * (request?.pageSize ?? 10))
    ),
  });

  if (request?.query) {
    searchParams.set("search_text", request.query);
  }
  if (request?.sentiment && request.sentiment !== "all") {
    searchParams.set("sentiment_label", request.sentiment);
  }
  if (request?.language && request.language !== "all") {
    searchParams.set("language", request.language);
  }
  if (request?.source && request.source !== "all") {
    searchParams.set("source_type", request.source);
  }
  if (request?.rating && request.rating !== "all") {
    searchParams.set("min_rating", request.rating);
    searchParams.set("max_rating", request.rating);
  }
  if (request?.date === "oldest") {
    searchParams.set("date_order", "oldest");
  }

  const reviewsResponse = await getJson<BackendReviewsListPayload>(
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
    {
      items: reviewsResponse.data.items.map((review) =>
        toFrontendReviewListItem(review, review.sentiment ?? null)
      ),
      total: reviewsResponse.data.total,
      page: Math.max(1, request?.page ?? 1),
      pageSize: reviewsResponse.data.limit,
      totalPages: Math.max(
        1,
        Math.ceil(reviewsResponse.data.total / reviewsResponse.data.limit)
      ),
      sourceOptions: reviewsResponse.data.source_types,
    },
    "backend"
  );
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function normalizeDashboardRequestFilters(
  filters?: Partial<DashboardFilters> | Record<string, string | string[] | undefined>
): DashboardFilters {
  const source = firstString(filters?.source);
  const language = firstString(filters?.language);
  const sentiment = firstString(filters?.sentiment);
  const range = firstString(filters?.range);

  return {
    range:
      range === "7d" || range === "30d" || range === "all"
        ? range
        : DEFAULT_DASHBOARD_FILTERS.range,
    source: source && source !== "all" ? source : DEFAULT_DASHBOARD_FILTERS.source,
    language:
      language === "en" || language === "ar"
        ? language
        : DEFAULT_DASHBOARD_FILTERS.language,
    sentiment:
      sentiment === "positive" || sentiment === "neutral" || sentiment === "negative"
        ? sentiment
        : DEFAULT_DASHBOARD_FILTERS.sentiment,
  };
}

function appendDashboardFilters(
  searchParams: URLSearchParams,
  filters: DashboardFilters
) {
  searchParams.set("range", filters.range);

  if (filters.source !== "all") {
    searchParams.set("source", filters.source);
  }
  if (filters.language !== "all") {
    searchParams.set("language", filters.language);
  }
  if (filters.sentiment !== "all") {
    searchParams.set("sentiment", filters.sentiment);
  }
}

function normalizeComparisonMetric(
  metric: BackendDashboardComparisonMetric
): DashboardComparisonMetric {
  return {
    current: metric.current,
    previous: metric.previous,
    delta: metric.delta,
    percentageChange: metric.percentage_change,
  };
}

function normalizeDistributionBucket(
  bucket: { label: string; value: number; share: number },
  variant: "sentiment" | "rating" | "source" | "language"
): DashboardDistributionBucket {
  if (variant === "sentiment") {
    const id = bucket.label as SentimentLabel;
    return {
      id,
      label: id,
      value: bucket.value,
      share: bucket.share,
      tone: id === "positive" ? "positive" : id === "negative" ? "negative" : "neutral",
    };
  }

  if (variant === "rating") {
    return {
      id: bucket.label,
      label: bucket.label,
      value: bucket.value,
      share: bucket.share,
      tone:
        Number(bucket.label) >= 4
          ? "positive"
          : Number(bucket.label) === 3
            ? "neutral"
            : "warning",
    };
  }

  if (variant === "source") {
    return {
      id: bucket.label,
      label: formatSourceLabel(bucket.label),
      value: bucket.value,
      share: bucket.share,
      tone: "default",
    };
  }

  return {
    id: bucket.label,
    label: bucket.label,
    value: bucket.value,
    share: bucket.share,
    tone: "default",
  };
}

function toFrontendSentiment(
  label: BackendSentimentRead["label"] | null | undefined,
  confidence: number | null | undefined,
  summaryTags: string[] | null | undefined
): Review["sentiment"] {
  return {
    label: label ?? "neutral",
    confidence: confidence ?? 0,
    summaryTags: summaryTags ?? [],
  };
}

function toFrontendReviewStatus(
  status: "pending" | "reviewed" | "responded"
): ReviewStatus {
  return normalizeStatus(status);
}

function toFrontendOverviewReview(
  review: BackendDashboardOverview["recent_reviews"][number]
): Review {
  return {
    id: review.review_id,
    source: formatSourceLabel(review.source_type),
    rating: review.rating ?? 0,
    language: normalizeLanguage(review.language),
    reviewerName: review.reviewer_name ?? "Anonymous",
    reviewText: review.review_text,
    reviewCreatedAt: review.review_created_at ?? new Date().toISOString(),
    status: toFrontendReviewStatus(review.status),
    sentiment: toFrontendSentiment(
      review.sentiment_label,
      review.sentiment_confidence,
      review.summary_tags
    ),
  };
}

function toFrontendPriorityReview(
  review: BackendDashboardOverview["priority_reviews"][number]
): DashboardPriorityReview {
  return {
    reviewId: review.review_id,
    reviewerName: review.reviewer_name ?? "Anonymous",
    source: formatSourceLabel(review.source_type),
    rating: review.rating ?? 0,
    language: normalizeLanguage(review.language),
    reviewText: review.review_text,
    reviewCreatedAt: review.review_created_at ?? new Date().toISOString(),
    status: toFrontendReviewStatus(review.status),
    sentiment: toFrontendSentiment(
      review.sentiment_label,
      review.sentiment_confidence,
      review.summary_tags
    ),
    priority: review.priority,
    reason: review.reason,
  };
}

function toFrontendActivityItem(
  item: BackendDashboardOverview["activity_feed"][number],
  index: number
) {
  return {
    id: `activity-${item.review_id}-${index}`,
    reviewId: item.review_id,
    type: item.type,
    occurredAt: item.occurred_at ?? new Date().toISOString(),
    source: formatSourceLabel(item.source_type),
    rating: item.rating ?? 0,
    language: normalizeLanguage(item.language),
    sentiment: item.sentiment_label ?? "neutral",
    status: toFrontendReviewStatus(item.status),
    reviewerName: item.reviewer_name ?? "Anonymous",
  };
}

function toFrontendSalesRecord(
  record: BackendDashboardOverview["sales_records"][number]
): SalesRecord {
  return {
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
  };
}

function toFrontendOverviewData(
  overview: BackendDashboardOverview
): DashboardOverviewData {
  return {
    metrics: {
      totalReviews: overview.metrics.total_reviews,
      averageRating: overview.metrics.average_rating,
      positiveShare: overview.metrics.positive_share,
      negativeShare: overview.metrics.negative_share,
      pendingReviews: overview.metrics.pending_reviews,
      reviewedReviews: overview.metrics.reviewed_reviews,
      respondedReviews: overview.metrics.responded_reviews,
      activeSources: overview.metrics.active_sources,
    } satisfies DashboardMetricSummary,
    distributions: {
      sentiment: overview.distributions.sentiment.map((bucket) =>
        normalizeDistributionBucket(bucket, "sentiment")
      ),
      ratings: overview.distributions.ratings.map((bucket) =>
        normalizeDistributionBucket(bucket, "rating")
      ),
      sources: overview.distributions.sources.map((bucket) =>
        normalizeDistributionBucket(bucket, "source")
      ),
      languages: overview.distributions.languages.map((bucket) =>
        normalizeDistributionBucket(bucket, "language")
      ),
    },
    recentReviews: overview.recent_reviews.map(toFrontendOverviewReview),
    priorityReviews: overview.priority_reviews.map(toFrontendPriorityReview),
    activityFeed: overview.activity_feed.map(toFrontendActivityItem),
    filterOptions: {
      sources: overview.filter_options.sources,
      languages: overview.filter_options.languages.map((language) =>
        normalizeLanguage(language)
      ) as ReviewLanguage[],
      sentiments: overview.filter_options.sentiments,
    },
    reviewTimeseries: overview.review_timeseries.map(
      (point): DashboardReviewTimeSeriesPoint => ({
        date: `${point.date}T00:00:00.000Z`,
        totalReviews: point.total_reviews,
        positiveReviews: point.positive_reviews,
        positiveShare: point.positive_share,
      })
    ),
    comparison: {
      totalReviews: normalizeComparisonMetric(overview.comparison.total_reviews),
      averageRating: normalizeComparisonMetric(overview.comparison.average_rating),
      positiveShare: normalizeComparisonMetric(overview.comparison.positive_share),
      negativeShare: normalizeComparisonMetric(overview.comparison.negative_share),
      pendingReviews: normalizeComparisonMetric(overview.comparison.pending_reviews),
      reviewedReviews: normalizeComparisonMetric(overview.comparison.reviewed_reviews),
      respondedReviews: normalizeComparisonMetric(overview.comparison.responded_reviews),
      activeSources: normalizeComparisonMetric(overview.comparison.active_sources),
      totalRevenue: normalizeComparisonMetric(overview.comparison.total_revenue),
      totalOrders: normalizeComparisonMetric(overview.comparison.total_orders),
      averageOrderValue: normalizeComparisonMetric(
        overview.comparison.average_order_value
      ),
      refundCount: normalizeComparisonMetric(overview.comparison.refund_count),
      refundValue: normalizeComparisonMetric(overview.comparison.refund_value),
      refundRate: normalizeComparisonMetric(overview.comparison.refund_rate),
    } satisfies DashboardComparison,
    salesSummary: {
      totalRevenue: overview.sales_summary.total_revenue,
      totalOrders: overview.sales_summary.total_orders,
      averageOrderValue: overview.sales_summary.average_order_value,
      refundCount: overview.sales_summary.refund_count,
      refundValue: overview.sales_summary.refund_value,
      refundRate: overview.sales_summary.refund_rate,
    } satisfies DashboardSalesSummary,
    salesRecords: overview.sales_records.map(toFrontendSalesRecord),
    capabilities: {
      reviewDataAvailable: overview.capabilities.review_data_available,
      salesDataAvailable: overview.capabilities.sales_data_available,
      salesDataNote: overview.capabilities.sales_data_note,
    },
  };
}

export const apiClient = {
  async getDashboard(
    request?: Partial<DashboardFilters> | Record<string, string | string[] | undefined>
  ): Promise<DashboardResponse> {
    const normalizedFilters = normalizeDashboardRequestFilters(request);
    const authContext = await getBackendAuthContext({
      requireBackendSession: false,
    });
    if (authContext.kind === "ready" && authContext.businessId) {
      const dashboardQuery = new URLSearchParams({
        business_id: authContext.businessId,
        limit: "75",
      });
      appendDashboardFilters(dashboardQuery, normalizedFilters);

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

      return success(
        getDashboardPayloadFromOverview(
          toFrontendOverviewData(overviewResponse.data),
          normalizedFilters
        ),
        "backend"
      );
    }

    return success(getDashboardData(normalizedFilters));
  },
  async getReviews(request?: ReviewsListRequest): Promise<ReviewsListResponse> {
    const authContext = await getBackendAuthContext({
      requireBackendSession: false,
    });
    if (authContext.kind === "ready" && authContext.businessId) {
      const reviewsResponse = await getBackendReviewsForBusiness(
        authContext.headers,
        authContext.businessId,
        request
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
        reviewsResponse.data,
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
      const sourceMatch =
        request?.source && request.source !== "all"
          ? review.source === formatSourceLabel(request.source)
          : true;
      const ratingMatch =
        request?.rating && request.rating !== "all"
          ? review.rating === Number(request.rating)
          : true;

      return queryMatch && sentimentMatch && languageMatch && sourceMatch && ratingMatch;
    }).sort((left, right) =>
      request?.date === "oldest"
        ? new Date(left.reviewCreatedAt).getTime() -
          new Date(right.reviewCreatedAt).getTime()
        : new Date(right.reviewCreatedAt).getTime() -
          new Date(left.reviewCreatedAt).getTime()
    );

    const pageSize = request?.pageSize ?? 10;
    const page = Math.max(1, request?.page ?? 1);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;
    const items = filtered
      .slice(offset, offset + pageSize)
      .map<ReviewListItem>((review) => ({
        id: review.id,
        source: review.source,
        rating: review.rating,
        language: review.language,
        reviewerName: review.reviewerName,
        reviewText: review.reviewText,
        reviewCreatedAt: review.reviewCreatedAt,
        status: review.status,
        sentiment: {
          label: review.sentiment.label,
        },
      }));

    return success({
      items,
      total: filtered.length,
      page: safePage,
      pageSize,
      totalPages,
      sourceOptions: Array.from(
        new Set(getReviews().map((review) => review.source.toLowerCase().replace(/\s+/g, "_")))
      ),
    });
  },
  async getReviewById(reviewId: string): Promise<ReviewDetailResponse> {
    const authContext = await getBackendAuthContext({
      requireBackendSession: false,
    });
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
    const authContext = await getBackendAuthContext({
      requireBackendSession: false,
    });

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
            authContext.authSession?.businesses[0]?.name ??
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
