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
  | "total_reviews"
  | "average_rating"
  | "positive_share"
  | "new_reviews"
  | "active_sources";

export type DashboardMetricTone = "default" | "positive" | "warning" | "negative";
export type DashboardTrendDirection = "up" | "down" | "stable";

export type DashboardMetric = {
  id: DashboardMetricId;
  value: number;
  displayValue: string;
  context?: {
    kind: "new_reviews" | "review_count" | "positive_reviews" | "source_count";
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

export type DashboardView = {
  metrics: DashboardMetric[];
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

export type DashboardPayload = {
  reviews: Review[];
  filterOptions: {
    sources: string[];
    languages: ReviewLanguage[];
    sentiments: SentimentLabel[];
    timeRanges: DashboardTimeRange[];
  };
  view: DashboardView;
};
