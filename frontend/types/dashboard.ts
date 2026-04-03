import type { Review, ReviewLanguage, ReviewStatus, SentimentLabel } from "@/types/review";

export type DashboardTimeRange = "7d" | "30d" | "all";
export type DashboardFilterValue = "all";

export type DashboardFilters = {
  range: DashboardTimeRange;
  source: string | DashboardFilterValue;
  language: ReviewLanguage | DashboardFilterValue;
  sentiment: SentimentLabel | DashboardFilterValue;
};

export type DashboardMetricId =
  | "total_revenue"
  | "total_orders"
  | "average_order_value"
  | "refund_rate"
  | "total_reviews"
  | "positive_share";

export type DashboardMetricTone = "default" | "positive" | "warning" | "negative";
export type DashboardTrendDirection = "up" | "down" | "stable";

export type DashboardMetric = {
  id: DashboardMetricId;
  value: number;
  displayValue: string;
  context?:
    | {
        kind: "new_reviews" | "positive_reviews" | "order_count" | "refund_value";
        value: number;
      }
    | {
        kind: "best_channel";
        label: SalesChannelId;
        value: number;
      };
  tone?: DashboardMetricTone;
  trend?: {
    direction: DashboardTrendDirection;
    delta: number;
    displayValue: string;
    comparisonRange: DashboardTimeRange | "baseline";
  };
  sparkline: number[];
};

export type DashboardDistributionTone =
  | "default"
  | "positive"
  | "neutral"
  | "negative"
  | "warning";

export type DashboardDistributionBucket = {
  id: string;
  label: string;
  value: number;
  share: number;
  tone?: DashboardDistributionTone;
};

export type DashboardPriorityLevel = "high" | "medium" | "low";
export type DashboardPriorityReason =
  | "negative_low_rating"
  | "unreviewed_negative"
  | "new_unreviewed"
  | "follow_up_needed";

export type DashboardPriorityReview = {
  reviewId: string;
  reviewerName: string;
  source: string;
  rating: number;
  language: ReviewLanguage;
  reviewText: string;
  reviewCreatedAt: string;
  status: ReviewStatus;
  sentiment: Review["sentiment"];
  priority: DashboardPriorityLevel;
  reason: DashboardPriorityReason;
};

export type DashboardActivityType =
  | "new_review"
  | "negative_alert"
  | "review_resolved"
  | "positive_signal";

export type DashboardActivityItem = {
  id: string;
  reviewId: string;
  type: DashboardActivityType;
  occurredAt: string;
  source: string;
  rating: number;
  language: ReviewLanguage;
  sentiment: SentimentLabel;
  status: ReviewStatus;
  reviewerName: string;
};

export type SalesChannelId =
  | "walk_in"
  | "delivery_app"
  | "instagram_dm"
  | "whatsapp";

export type SalesProductCategory =
  | "signature_drinks"
  | "desserts"
  | "breakfast"
  | "bundles";

export type SalesProductSnapshot = {
  id: string;
  label: string;
  category: SalesProductCategory;
  revenue: number;
  units: number;
};

export type SalesRecord = {
  date: string;
  revenue: number;
  orders: number;
  refundCount: number;
  refundValue: number;
  channelRevenue: Record<SalesChannelId, number>;
  products: SalesProductSnapshot[];
};

export type DashboardSalesSeriesPoint = {
  date: string;
  label: string;
  revenue: number;
  orders: number;
  refundValue: number;
};

export type DashboardSalesChannelBreakdown = {
  id: SalesChannelId;
  revenue: number;
  orders: number;
  share: number;
};

export type DashboardSalesProduct = {
  id: string;
  label: string;
  category: SalesProductCategory;
  revenue: number;
  units: number;
  share: number;
};

export type DashboardSalesView = {
  executiveMetrics: DashboardMetric[];
  summary: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    refundCount: number;
    refundValue: number;
    refundRate: number;
    bestChannel: SalesChannelId | null;
  };
  revenueSeries: DashboardSalesSeriesPoint[];
  refundSeries: DashboardSalesSeriesPoint[];
  channelMix: DashboardSalesChannelBreakdown[];
  topProducts: DashboardSalesProduct[];
};

export type DashboardReviewView = {
  distributions: {
    sentiment: DashboardDistributionBucket[];
    ratings: DashboardDistributionBucket[];
    sources: DashboardDistributionBucket[];
    languages: DashboardDistributionBucket[];
  };
  recentReviews: Review[];
  priorityReviews: DashboardPriorityReview[];
  activityFeed: DashboardActivityItem[];
  reviewCount: number;
};

export type DashboardView = {
  review: DashboardReviewView;
  sales: DashboardSalesView;
};

export type DashboardCapabilities = {
  reviewDataAvailable: boolean;
  salesDataAvailable: boolean;
  salesDataNote: string | null;
};

export type DashboardPayload = {
  reviews: Review[];
  salesRecords: SalesRecord[];
  capabilities: DashboardCapabilities;
  filterOptions: {
    sources: string[];
    languages: ReviewLanguage[];
    sentiments: SentimentLabel[];
    timeRanges: DashboardTimeRange[];
  };
  view: DashboardView;
};
