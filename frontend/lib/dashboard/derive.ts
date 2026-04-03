import type {
  DashboardActivityItem,
  DashboardDistributionBucket,
  DashboardFilters,
  DashboardMetric,
  DashboardPayload,
  DashboardPriorityReview,
  DashboardTimeRange,
  DashboardTrendDirection,
  DashboardView,
} from "@/types/dashboard";
import type { Review } from "@/types/review";

export const DASHBOARD_TIME_RANGES: DashboardTimeRange[] = ["7d", "30d", "all"];

export const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = {
  range: "30d",
  source: "all",
  language: "all",
  sentiment: "all",
};

const DEFAULT_SPARKLINE = [0, 0, 0, 0, 0, 0];

export function getDashboardPayload(reviews: Review[]): DashboardPayload {
  const sortedReviews = sortReviews(reviews);

  return {
    reviews: sortedReviews,
    filterOptions: {
      sources: Array.from(new Set(sortedReviews.map((review) => review.source))),
      languages: Array.from(new Set(sortedReviews.map((review) => review.language))),
      sentiments: ["positive", "neutral", "negative"],
      timeRanges: DASHBOARD_TIME_RANGES,
    },
    view: getDashboardView(sortedReviews, DEFAULT_DASHBOARD_FILTERS),
  };
}

export function getDashboardView(
  reviews: Review[],
  filters: DashboardFilters
): DashboardView {
  const allReviews = sortReviews(reviews);
  const filteredReviews = filterReviews(allReviews, filters);
  const previousWindowReviews = getPreviousWindowReviews(allReviews, filters);

  return {
    metrics: buildMetrics(filteredReviews, previousWindowReviews, filters.range),
    distributions: {
      sentiment: buildSentimentDistribution(filteredReviews),
      ratings: buildRatingDistribution(filteredReviews),
      sources: buildSourceDistribution(filteredReviews),
      languages: buildLanguageDistribution(filteredReviews),
    },
    recentReviews: filteredReviews.slice(0, 4),
    priorityReviews: buildPriorityReviews(filteredReviews),
    activityFeed: buildActivityFeed(filteredReviews),
    reviewCount: filteredReviews.length,
  };
}

function sortReviews(reviews: Review[]): Review[] {
  return [...reviews].sort(
    (left, right) =>
      new Date(right.reviewCreatedAt).getTime() -
      new Date(left.reviewCreatedAt).getTime()
  );
}

function filterReviews(reviews: Review[], filters: DashboardFilters): Review[] {
  const latestDate = getLatestReviewDate(reviews);
  const rangeStart =
    latestDate && filters.range !== "all"
      ? getRangeStart(latestDate, filters.range)
      : null;

  return reviews.filter((review) => {
    const createdAt = new Date(review.reviewCreatedAt);
    const rangeMatch = rangeStart ? createdAt >= rangeStart : true;
    const sourceMatch =
      filters.source === "all" || review.source === filters.source;
    const languageMatch =
      filters.language === "all" || review.language === filters.language;
    const sentimentMatch =
      filters.sentiment === "all" || review.sentiment.label === filters.sentiment;

    return rangeMatch && sourceMatch && languageMatch && sentimentMatch;
  });
}

function getPreviousWindowReviews(
  reviews: Review[],
  filters: DashboardFilters
): Review[] {
  if (filters.range === "all") {
    return [];
  }

  const latestDate = getLatestReviewDate(reviews);
  if (!latestDate) {
    return [];
  }

  const currentRangeStart = getRangeStart(latestDate, filters.range);
  const windowMs = latestDate.getTime() - currentRangeStart.getTime();
  const previousRangeEnd = new Date(currentRangeStart.getTime() - 1);
  const previousRangeStart = new Date(previousRangeEnd.getTime() - windowMs);

  return reviews.filter((review) => {
    const createdAt = new Date(review.reviewCreatedAt);
    const rangeMatch =
      createdAt >= previousRangeStart && createdAt <= previousRangeEnd;
    const sourceMatch =
      filters.source === "all" || review.source === filters.source;
    const languageMatch =
      filters.language === "all" || review.language === filters.language;
    const sentimentMatch =
      filters.sentiment === "all" || review.sentiment.label === filters.sentiment;

    return rangeMatch && sourceMatch && languageMatch && sentimentMatch;
  });
}

function getLatestReviewDate(reviews: Review[]): Date | null {
  if (reviews.length === 0) {
    return null;
  }

  return new Date(
    reviews.reduce((latest, review) => {
      const createdAt = new Date(review.reviewCreatedAt).getTime();
      return Math.max(latest, createdAt);
    }, 0)
  );
}

function getRangeStart(latestDate: Date, range: Exclude<DashboardTimeRange, "all">): Date {
  const dayCount = range === "7d" ? 7 : 30;
  const start = new Date(latestDate);
  start.setDate(start.getDate() - (dayCount - 1));
  return start;
}

function buildMetrics(
  reviews: Review[],
  previousWindowReviews: Review[],
  range: DashboardTimeRange
): DashboardMetric[] {
  const reviewCount = reviews.length;
  const newReviewCount = reviews.filter((review) => review.status === "new").length;
  const positiveCount = reviews.filter(
    (review) => review.sentiment.label === "positive"
  ).length;
  const activeSourceCount = new Set(reviews.map((review) => review.source)).size;
  const averageRating = reviewCount
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount
    : 0;
  const positiveShare = reviewCount ? (positiveCount / reviewCount) * 100 : 0;

  return [
    {
      id: "total_reviews",
      value: reviewCount,
      displayValue: String(reviewCount),
      context: { kind: "new_reviews", value: newReviewCount },
      sparkline: buildSparkline(reviews, "count", range),
      trend: buildTrend(reviewCount, previousWindowReviews.length, range, false),
    },
    {
      id: "average_rating",
      value: averageRating,
      displayValue: averageRating ? averageRating.toFixed(1) : "0.0",
      context: { kind: "source_count", value: activeSourceCount },
      sparkline: buildSparkline(reviews, "rating", range),
      trend: buildTrend(
        averageRating,
        previousWindowReviews.length
          ? previousWindowReviews.reduce((sum, review) => sum + review.rating, 0) /
              previousWindowReviews.length
          : 0,
        range,
        true
      ),
    },
    {
      id: "positive_share",
      value: positiveShare,
      displayValue: `${Math.round(positiveShare)}%`,
      context: { kind: "positive_reviews", value: positiveCount },
      tone: "positive",
      sparkline: buildSparkline(reviews, "positive-share", range),
      trend: buildTrend(
        positiveShare,
        previousWindowReviews.length
          ? (previousWindowReviews.filter(
              (review) => review.sentiment.label === "positive"
            ).length /
              previousWindowReviews.length) *
              100
          : 0,
        range,
        false,
        "%"
      ),
    },
    {
      id: "new_reviews",
      value: newReviewCount,
      displayValue: String(newReviewCount),
      context: { kind: "review_count", value: reviewCount },
      tone: newReviewCount > 0 ? "warning" : "default",
      sparkline: buildSparkline(reviews, "new-count", range),
      trend: buildTrend(
        newReviewCount,
        previousWindowReviews.filter((review) => review.status === "new").length,
        range,
        false
      ),
    },
    {
      id: "active_sources",
      value: activeSourceCount,
      displayValue: String(activeSourceCount),
      context: { kind: "review_count", value: reviewCount },
      sparkline: buildSparkline(reviews, "source-count", range),
      trend: buildTrend(
        activeSourceCount,
        new Set(previousWindowReviews.map((review) => review.source)).size,
        range,
        false
      ),
    },
  ];
}

function buildTrend(
  currentValue: number,
  previousValue: number,
  range: DashboardTimeRange,
  fixedOneDecimal: boolean,
  suffix = ""
): DashboardMetric["trend"] | undefined {
  if (range === "all") {
    return undefined;
  }

  const delta = currentValue - previousValue;
  const direction: DashboardTrendDirection =
    delta > 0 ? "up" : delta < 0 ? "down" : "stable";
  const absoluteDelta = Math.abs(delta);
  const formattedValue = fixedOneDecimal
    ? absoluteDelta.toFixed(1)
    : Number.isInteger(absoluteDelta)
      ? String(absoluteDelta)
      : absoluteDelta.toFixed(1);

  return {
    direction,
    delta,
    displayValue: `${delta > 0 ? "+" : delta < 0 ? "-" : ""}${formattedValue}${suffix}`,
    comparisonRange: range,
  };
}

function buildSparkline(
  reviews: Review[],
  metric:
    | "count"
    | "rating"
    | "positive-share"
    | "new-count"
    | "source-count",
  range: DashboardTimeRange
): number[] {
  if (reviews.length === 0) {
    return DEFAULT_SPARKLINE;
  }

  const latestDate = getLatestReviewDate(reviews);
  if (!latestDate) {
    return DEFAULT_SPARKLINE;
  }

  const binCount = 6;
  const comparisonRange = range === "all" ? "30d" : range;
  const rangeStart = getRangeStart(latestDate, comparisonRange);
  const rangeMs = latestDate.getTime() - rangeStart.getTime() || 1;
  const binMs = Math.max(1, rangeMs / binCount);
  const bins = Array.from({ length: binCount }, () => [] as Review[]);

  for (const review of reviews) {
    const createdAt = new Date(review.reviewCreatedAt).getTime();
    const normalizedIndex = Math.min(
      binCount - 1,
      Math.max(0, Math.floor((createdAt - rangeStart.getTime()) / binMs))
    );
    bins[normalizedIndex].push(review);
  }

  return bins.map((bucket) => {
    if (bucket.length === 0) {
      return 0;
    }
    if (metric === "rating") {
      return (
        bucket.reduce((sum, review) => sum + review.rating, 0) / bucket.length
      );
    }
    if (metric === "positive-share") {
      return (
        (bucket.filter((review) => review.sentiment.label === "positive").length /
          bucket.length) *
        100
      );
    }
    if (metric === "new-count") {
      return bucket.filter((review) => review.status === "new").length;
    }
    if (metric === "source-count") {
      return new Set(bucket.map((review) => review.source)).size;
    }
    return bucket.length;
  });
}

function buildSentimentDistribution(reviews: Review[]): DashboardDistributionBucket[] {
  return buildBucketDistribution(
    [
      { id: "positive", label: "positive", tone: "positive" },
      { id: "neutral", label: "neutral", tone: "neutral" },
      { id: "negative", label: "negative", tone: "negative" },
    ],
    reviews.length,
    (item) => reviews.filter((review) => review.sentiment.label === item.id).length
  );
}

function buildRatingDistribution(reviews: Review[]): DashboardDistributionBucket[] {
  return buildBucketDistribution(
    ["5", "4", "3", "2", "1"].map((rating) => ({
      id: rating,
      label: rating,
      tone: Number(rating) >= 4 ? "positive" : Number(rating) === 3 ? "neutral" : "warning",
    })),
    reviews.length,
    (item) => reviews.filter((review) => review.rating === Number(item.id)).length
  );
}

function buildSourceDistribution(reviews: Review[]): DashboardDistributionBucket[] {
  const sourceEntries = Array.from(new Set(reviews.map((review) => review.source))).map(
    (source) => ({
      id: source,
      label: source,
      tone: "default" as const,
    })
  );

  return buildBucketDistribution(
    sourceEntries,
    reviews.length,
    (item) => reviews.filter((review) => review.source === item.id).length
  ).sort((left, right) => right.value - left.value);
}

function buildLanguageDistribution(reviews: Review[]): DashboardDistributionBucket[] {
  return buildBucketDistribution(
    [
      { id: "en", label: "en", tone: "default" },
      { id: "ar", label: "ar", tone: "default" },
    ],
    reviews.length,
    (item) => reviews.filter((review) => review.language === item.id).length
  );
}

function buildBucketDistribution(
  items: Array<{ id: string; label: string; tone: DashboardDistributionBucket["tone"] }>,
  total: number,
  countResolver: (item: { id: string }) => number
): DashboardDistributionBucket[] {
  return items.map((item) => {
    const value = countResolver(item);
    return {
      id: item.id,
      label: item.label,
      value,
      share: total ? value / total : 0,
      tone: item.tone,
    };
  });
}

function buildPriorityReviews(reviews: Review[]): DashboardPriorityReview[] {
  return reviews
    .map((review) => {
      const reason = getPriorityReason(review);
      const priority = getPriorityLevel(review, reason);

      return {
        reviewId: review.id,
        reviewerName: review.reviewerName,
        source: review.source,
        rating: review.rating,
        language: review.language,
        reviewText: review.reviewText,
        reviewCreatedAt: review.reviewCreatedAt,
        status: review.status,
        sentiment: review.sentiment,
        priority,
        reason,
      };
    })
    .sort((left, right) => {
      const priorityWeight =
        getPriorityWeight(right.priority) - getPriorityWeight(left.priority);
      if (priorityWeight !== 0) {
        return priorityWeight;
      }
      return (
        new Date(right.reviewCreatedAt).getTime() -
        new Date(left.reviewCreatedAt).getTime()
      );
    })
    .slice(0, 4);
}

function buildActivityFeed(reviews: Review[]): DashboardActivityItem[] {
  return reviews.slice(0, 6).map((review, index) => ({
    id: `activity-${review.id}-${index}`,
    reviewId: review.id,
    type: getActivityType(review),
    occurredAt: review.reviewCreatedAt,
    source: review.source,
    rating: review.rating,
    language: review.language,
    sentiment: review.sentiment.label,
    status: review.status,
    reviewerName: review.reviewerName,
  }));
}

function getPriorityReason(review: Review): DashboardPriorityReview["reason"] {
  if (review.sentiment.label === "negative" && review.rating <= 2) {
    return "negative_low_rating";
  }
  if (review.status === "new" && review.sentiment.label === "negative") {
    return "unreviewed_negative";
  }
  if (review.status === "new") {
    return "new_unreviewed";
  }
  return "follow_up_needed";
}

function getPriorityLevel(
  review: Review,
  reason: DashboardPriorityReview["reason"]
): DashboardPriorityReview["priority"] {
  if (
    reason === "negative_low_rating" ||
    (reason === "unreviewed_negative" && review.sentiment.confidence >= 0.85)
  ) {
    return "high";
  }
  if (reason === "unreviewed_negative" || reason === "new_unreviewed") {
    return "medium";
  }
  return "low";
}

function getPriorityWeight(priority: DashboardPriorityReview["priority"]): number {
  if (priority === "high") {
    return 3;
  }
  if (priority === "medium") {
    return 2;
  }
  return 1;
}

function getActivityType(review: Review): DashboardActivityItem["type"] {
  if (review.status === "new" && review.sentiment.label === "negative") {
    return "negative_alert";
  }
  if (review.status === "new") {
    return "new_review";
  }
  if (review.sentiment.label === "positive" && review.rating >= 4) {
    return "positive_signal";
  }
  return "review_resolved";
}
