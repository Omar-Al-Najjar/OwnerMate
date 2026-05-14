import type {
  DashboardActivityItem,
  DashboardCapabilities,
  DashboardComparison,
  DashboardComparisonMetric,
  DashboardDistributionBucket,
  DashboardFilters,
  DashboardFilterOptions,
  DashboardMetric,
  DashboardMetricSummary,
  DashboardOverviewData,
  DashboardPayload,
  DashboardPriorityReview,
  DashboardReviewDistributions,
  DashboardReviewTimeSeriesPoint,
  DashboardSalesChannelBreakdown,
  DashboardSalesProduct,
  DashboardSalesSeriesPoint,
  DashboardSalesSummary,
  DashboardSalesView,
  DashboardTimeRange,
  DashboardTrendDirection,
  DashboardView,
  SalesChannelId,
  SalesProductCategory,
  SalesRecord,
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

export function getDashboardPayload(
  reviews: Review[],
  salesRecords: SalesRecord[],
  capabilities?: Partial<DashboardCapabilities>,
  filters: DashboardFilters = DEFAULT_DASHBOARD_FILTERS
): DashboardPayload {
  const sortedReviews = sortReviews(reviews);
  const sortedSales = sortSalesRecords(salesRecords);
  const hasSalesData = sortedSales.length > 0;
  const filteredReviews = filterReviews(sortedReviews, filters);
  const view = getDashboardView(sortedReviews, sortedSales, filters);

  return {
    salesRecords: sortedSales,
    capabilities: {
      reviewDataAvailable: true,
      salesDataAvailable: hasSalesData,
      salesDataNote: hasSalesData
        ? null
        : "Sales metrics are not available in the backend yet.",
      ...capabilities,
    },
    filterOptions: {
      sources: Array.from(new Set(sortedReviews.map((review) => review.source))),
      languages: Array.from(new Set(sortedReviews.map((review) => review.language))),
      sentiments: ["positive", "neutral", "negative"],
      timeRanges: DASHBOARD_TIME_RANGES,
    },
    metrics: buildDashboardMetricSummary(
      view.review.reviewCount,
      view.review.distributions,
      filteredReviews
    ),
    comparison: buildDashboardComparisonFromReviewsAndSales(
      sortedReviews,
      sortedSales,
      filters
    ),
    reviewTimeseries: buildReviewTimeseriesFromReviews(sortedReviews, filters),
    salesSummary: {
      totalRevenue: view.sales.summary.totalRevenue,
      totalOrders: view.sales.summary.totalOrders,
      averageOrderValue: view.sales.summary.averageOrderValue,
      refundCount: view.sales.summary.refundCount,
      refundValue: view.sales.summary.refundValue,
      refundRate: view.sales.summary.refundRate,
    },
    view,
  };
}

export function getDashboardPayloadFromOverview(
  overview: DashboardOverviewData,
  filters: DashboardFilters
): DashboardPayload {
  return {
    salesRecords: sortSalesRecords(overview.salesRecords),
    capabilities: overview.capabilities,
    filterOptions: {
      ...overview.filterOptions,
      timeRanges: DASHBOARD_TIME_RANGES,
    },
    metrics: overview.metrics,
    comparison: overview.comparison,
    reviewTimeseries: overview.reviewTimeseries,
    salesSummary: overview.salesSummary,
    view: buildDashboardViewFromOverview(overview, filters),
  };
}

export function getDashboardView(
  reviews: Review[],
  salesRecords: SalesRecord[],
  filters: DashboardFilters
): DashboardView {
  const allReviews = sortReviews(reviews);
  const allSales = sortSalesRecords(salesRecords);
  const filteredReviews = filterReviews(allReviews, filters);
  const previousWindowReviews = getPreviousWindowReviews(allReviews, filters);
  const filteredSales = filterSalesRecords(allSales, filters.range);
  const previousWindowSales = getPreviousWindowSalesRecords(allSales, filters.range);

  return {
    review: {
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
    },
    sales: buildSalesView(
      filteredSales,
      previousWindowSales,
      filteredReviews,
      previousWindowReviews,
      filters.range
    ),
  };
}

function buildDashboardViewFromOverview(
  overview: DashboardOverviewData,
  filters: DashboardFilters
): DashboardView {
  const salesRecords = sortSalesRecords(overview.salesRecords);
  const channelMix = buildChannelMix(salesRecords);
  const bestChannel = channelMix[0] ?? null;

  return {
    review: {
      distributions: overview.distributions,
      recentReviews: overview.recentReviews,
      priorityReviews: overview.priorityReviews,
      activityFeed: overview.activityFeed,
      reviewCount: overview.metrics.totalReviews,
    },
    sales: {
      executiveMetrics: buildExecutiveMetricsFromOverview(
        overview,
        filters.range,
        bestChannel
      ),
      summary: {
        totalRevenue: overview.salesSummary.totalRevenue,
        totalOrders: overview.salesSummary.totalOrders,
        averageOrderValue: overview.salesSummary.averageOrderValue,
        refundCount: overview.salesSummary.refundCount,
        refundValue: overview.salesSummary.refundValue,
        refundRate: overview.salesSummary.refundRate,
        bestChannel: bestChannel?.id ?? null,
      },
      revenueSeries: buildSalesSeries(salesRecords),
      refundSeries: buildSalesSeries(salesRecords),
      channelMix,
      topProducts: buildTopProducts(salesRecords),
    },
  };
}

export function normalizeTimeSeriesData(
  data: DashboardSalesSeriesPoint[],
  range: DashboardTimeRange
): DashboardSalesSeriesPoint[] {
  if (data.length === 0) {
    return [];
  }

  const sorted = [...data].sort(
    (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
  );
  const latestDate = toUtcDay(sorted[sorted.length - 1].date);
  const startDate =
    range === "all"
      ? toUtcDay(sorted[0].date)
      : getRangeStart(latestDate, range);
  const pointMap = new Map(sorted.map((point) => [toUtcDateKey(point.date), point]));
  const normalized: DashboardSalesSeriesPoint[] = [];

  for (
    let cursor = new Date(startDate);
    cursor.getTime() <= latestDate.getTime();
    cursor = addUtcDays(cursor, 1)
  ) {
    const key = toUtcDateKey(cursor.toISOString());
    const existing = pointMap.get(key);
    const date = `${key}T00:00:00.000Z`;

    normalized.push(
      existing
        ? { ...existing, date, label: formatSeriesLabel(date) }
        : {
            date,
            label: formatSeriesLabel(date),
            revenue: null,
            orders: null,
            refundValue: null,
          }
    );
  }

  return normalized;
}

function sortReviews(reviews: Review[]): Review[] {
  return [...reviews].sort(
    (left, right) =>
      new Date(right.reviewCreatedAt).getTime() -
      new Date(left.reviewCreatedAt).getTime()
  );
}

function sortSalesRecords(salesRecords: SalesRecord[]): SalesRecord[] {
  return [...salesRecords].sort(
    (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime()
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

function filterSalesRecords(
  salesRecords: SalesRecord[],
  range: DashboardTimeRange
): SalesRecord[] {
  if (range === "all") {
    return salesRecords;
  }

  const latestDate = getLatestSalesDate(salesRecords);
  if (!latestDate) {
    return [];
  }

  const rangeStart = getRangeStart(latestDate, range);
  return salesRecords.filter((record) => new Date(record.date) >= rangeStart);
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

function getPreviousWindowSalesRecords(
  salesRecords: SalesRecord[],
  range: DashboardTimeRange
): SalesRecord[] {
  if (range === "all") {
    return [];
  }

  const latestDate = getLatestSalesDate(salesRecords);
  if (!latestDate) {
    return [];
  }

  const currentRangeStart = getRangeStart(latestDate, range);
  const windowMs = latestDate.getTime() - currentRangeStart.getTime();
  const previousRangeEnd = new Date(currentRangeStart.getTime() - 1);
  const previousRangeStart = new Date(previousRangeEnd.getTime() - windowMs);

  return salesRecords.filter((record) => {
    const createdAt = new Date(record.date);
    return createdAt >= previousRangeStart && createdAt <= previousRangeEnd;
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

function getLatestSalesDate(salesRecords: SalesRecord[]): Date | null {
  if (salesRecords.length === 0) {
    return null;
  }

  return new Date(salesRecords[salesRecords.length - 1].date);
}

function getRangeStart(latestDate: Date, range: Exclude<DashboardTimeRange, "all">): Date {
  const dayCount = range === "7d" ? 7 : 30;
  const start = new Date(latestDate);
  start.setDate(start.getDate() - (dayCount - 1));
  return start;
}

function buildSalesView(
  salesRecords: SalesRecord[],
  previousSalesRecords: SalesRecord[],
  reviews: Review[],
  previousReviews: Review[],
  range: DashboardTimeRange
): DashboardSalesView {
  const totalRevenue = sumBy(salesRecords, (record) => record.revenue);
  const totalOrders = sumBy(salesRecords, (record) => record.orders);
  const refundCount = sumBy(salesRecords, (record) => record.refundCount);
  const refundValue = sumBy(salesRecords, (record) => record.refundValue);
  const averageOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
  const refundRate = totalOrders ? (refundCount / totalOrders) * 100 : 0;
  const reviewCount = reviews.length;
  const positiveReviewCount = reviews.filter(
    (review) => review.sentiment.label === "positive"
  ).length;
  const positiveShare = reviewCount ? (positiveReviewCount / reviewCount) * 100 : 0;

  const previousRevenue = sumBy(previousSalesRecords, (record) => record.revenue);
  const previousOrders = sumBy(previousSalesRecords, (record) => record.orders);
  const previousRefundCount = sumBy(
    previousSalesRecords,
    (record) => record.refundCount
  );
  const previousRefundValue = sumBy(
    previousSalesRecords,
    (record) => record.refundValue
  );
  const previousAverageOrderValue = previousOrders
    ? previousRevenue / previousOrders
    : 0;
  const previousRefundRate = previousOrders
    ? (previousRefundCount / previousOrders) * 100
    : 0;
  const previousReviewCount = previousReviews.length;
  const previousPositiveShare = previousReviewCount
    ? (previousReviews.filter((review) => review.sentiment.label === "positive").length /
        previousReviewCount) *
      100
    : 0;

  const channelMix = buildChannelMix(salesRecords);
  const bestChannel = channelMix[0] ?? null;

  return {
    executiveMetrics: [
      {
        id: "total_revenue",
        value: totalRevenue,
        displayValue: formatCurrencyCompact(totalRevenue),
        context: bestChannel
          ? {
              kind: "best_channel",
              label: bestChannel.id,
              value: bestChannel.revenue,
            }
          : undefined,
        tone: "positive",
        sparkline: buildSalesSparkline(salesRecords, "revenue", range),
        trend: buildTrend(totalRevenue, previousRevenue, range, false, "$"),
      },
      {
        id: "total_orders",
        value: totalOrders,
        displayValue: String(totalOrders),
        context: { kind: "refund_value", value: refundValue },
        sparkline: buildSalesSparkline(salesRecords, "orders", range),
        trend: buildTrend(totalOrders, previousOrders, range, false),
      },
      {
        id: "average_order_value",
        value: averageOrderValue,
        displayValue: formatCurrency(averageOrderValue),
        context: { kind: "order_count", value: totalOrders },
        sparkline: buildSalesSparkline(salesRecords, "average-order-value", range),
        trend: buildTrend(
          averageOrderValue,
          previousAverageOrderValue,
          range,
          true,
          "$"
        ),
      },
      {
        id: "refund_rate",
        value: refundRate,
        displayValue: `${refundRate.toFixed(1)}%`,
        context: { kind: "refund_value", value: refundValue },
        tone: refundRate > 4 ? "warning" : "default",
        sparkline: buildSalesSparkline(salesRecords, "refund-rate", range),
        trend: buildTrend(refundRate, previousRefundRate, range, true, "%"),
      },
      {
        id: "total_reviews",
        value: reviewCount,
        displayValue: String(reviewCount),
        context: {
          kind: "new_reviews",
          value: reviews.filter((review) => review.status === "new").length,
        },
        sparkline: buildReviewSparkline(reviews, "count", range),
        trend: buildTrend(reviewCount, previousReviewCount, range, false),
      },
      {
        id: "positive_share",
        value: positiveShare,
        displayValue: `${Math.round(positiveShare)}%`,
        context: { kind: "positive_reviews", value: positiveReviewCount },
        tone: "positive",
        sparkline: buildReviewSparkline(reviews, "positive-share", range),
        trend: buildTrend(
          positiveShare,
          previousPositiveShare,
          range,
          false,
          "%"
        ),
      },
    ],
    summary: {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      refundCount,
      refundValue,
      refundRate,
      bestChannel: bestChannel?.id ?? null,
    },
    revenueSeries: buildSalesSeries(salesRecords),
    refundSeries: buildSalesSeries(salesRecords),
    channelMix,
    topProducts: buildTopProducts(salesRecords),
  };
}

function buildExecutiveMetricsFromOverview(
  overview: DashboardOverviewData,
  range: DashboardFilters["range"],
  bestChannel: DashboardSalesChannelBreakdown | null
): DashboardMetric[] {
  const positiveReviewCount =
    overview.distributions.sentiment.find((bucket) => bucket.id === "positive")?.value ??
    0;

  return [
    {
      id: "total_revenue",
      value: overview.salesSummary.totalRevenue,
      displayValue: formatCurrencyCompact(overview.salesSummary.totalRevenue),
      context: bestChannel
        ? {
            kind: "best_channel",
            label: bestChannel.id,
            value: bestChannel.revenue,
          }
        : undefined,
      tone: "positive",
      sparkline: buildSalesSparkline(overview.salesRecords, "revenue", range),
      trend: buildTrendFromComparisonMetric(
        overview.comparison.totalRevenue,
        range,
        false,
        "$"
      ),
    },
    {
      id: "total_orders",
      value: overview.salesSummary.totalOrders,
      displayValue: String(overview.salesSummary.totalOrders),
      context: { kind: "refund_value", value: overview.salesSummary.refundValue },
      sparkline: buildSalesSparkline(overview.salesRecords, "orders", range),
      trend: buildTrendFromComparisonMetric(
        overview.comparison.totalOrders,
        range,
        false
      ),
    },
    {
      id: "average_order_value",
      value: overview.salesSummary.averageOrderValue,
      displayValue: formatCurrency(overview.salesSummary.averageOrderValue),
      context: { kind: "order_count", value: overview.salesSummary.totalOrders },
      sparkline: buildSalesSparkline(
        overview.salesRecords,
        "average-order-value",
        range
      ),
      trend: buildTrendFromComparisonMetric(
        overview.comparison.averageOrderValue,
        range,
        true,
        "$"
      ),
    },
    {
      id: "refund_rate",
      value: overview.salesSummary.refundRate,
      displayValue: `${overview.salesSummary.refundRate.toFixed(1)}%`,
      context: { kind: "refund_value", value: overview.salesSummary.refundValue },
      tone: overview.salesSummary.refundRate > 4 ? "warning" : "default",
      sparkline: buildSalesSparkline(overview.salesRecords, "refund-rate", range),
      trend: buildTrendFromComparisonMetric(
        overview.comparison.refundRate,
        range,
        true,
        "%"
      ),
    },
    {
      id: "total_reviews",
      value: overview.metrics.totalReviews,
      displayValue: String(overview.metrics.totalReviews),
      context: {
        kind: "new_reviews",
        value: overview.metrics.pendingReviews,
      },
      sparkline: buildReviewSparklineFromTimeSeries(
        overview.reviewTimeseries,
        "count",
        range
      ),
      trend: buildTrendFromComparisonMetric(
        overview.comparison.totalReviews,
        range,
        false
      ),
    },
    {
      id: "positive_share",
      value: overview.metrics.positiveShare,
      displayValue: `${Math.round(overview.metrics.positiveShare)}%`,
      context: { kind: "positive_reviews", value: positiveReviewCount },
      tone: "positive",
      sparkline: buildReviewSparklineFromTimeSeries(
        overview.reviewTimeseries,
        "positive-share",
        range
      ),
      trend: buildTrendFromComparisonMetric(
        overview.comparison.positiveShare,
        range,
        false,
        "%"
      ),
    },
  ];
}

function buildDashboardMetricSummary(
  reviewCount: number,
  distributions: DashboardReviewDistributions,
  reviews: Review[]
): DashboardMetricSummary {
  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : null;
  const positiveShare =
    distributions.sentiment.find((bucket) => bucket.id === "positive")?.share ?? 0;
  const negativeShare =
    distributions.sentiment.find((bucket) => bucket.id === "negative")?.share ?? 0;

  return {
    totalReviews: reviewCount,
    averageRating:
      averageRating === null ? null : Number(averageRating.toFixed(2)),
    positiveShare: Number((positiveShare * 100).toFixed(2)),
    negativeShare: Number((negativeShare * 100).toFixed(2)),
    pendingReviews: reviews.filter((review) => review.status === "new").length,
    reviewedReviews: reviews.filter((review) => review.status === "reviewed").length,
    respondedReviews: 0,
    activeSources: new Set(reviews.map((review) => review.source)).size,
  };
}

function buildDashboardComparisonFromReviewsAndSales(
  reviews: Review[],
  salesRecords: SalesRecord[],
  filters: DashboardFilters
): DashboardComparison {
  const currentReviews = filterReviews(reviews, filters);
  const previousReviews = getPreviousWindowReviews(reviews, filters);
  const currentSales = filterSalesRecords(salesRecords, filters.range);
  const previousSales = getPreviousWindowSalesRecords(salesRecords, filters.range);
  const currentView = buildSalesView(
    currentSales,
    previousSales,
    currentReviews,
    previousReviews,
    filters.range
  );
  const currentMetrics = buildDashboardMetricSummary(
    currentReviews.length,
    {
      sentiment: buildSentimentDistribution(currentReviews),
      ratings: buildRatingDistribution(currentReviews),
      sources: buildSourceDistribution(currentReviews),
      languages: buildLanguageDistribution(currentReviews),
    },
    currentReviews
  );
  const previousMetrics = buildDashboardMetricSummary(
    previousReviews.length,
    {
      sentiment: buildSentimentDistribution(previousReviews),
      ratings: buildRatingDistribution(previousReviews),
      sources: buildSourceDistribution(previousReviews),
      languages: buildLanguageDistribution(previousReviews),
    },
    previousReviews
  );
  const previousSalesSummary = buildSalesSummaryFromRecords(previousSales);

  return {
    totalReviews: buildComparisonMetric(currentMetrics.totalReviews, previousMetrics.totalReviews),
    averageRating: buildComparisonMetric(currentMetrics.averageRating, previousMetrics.averageRating),
    positiveShare: buildComparisonMetric(currentMetrics.positiveShare, previousMetrics.positiveShare),
    negativeShare: buildComparisonMetric(currentMetrics.negativeShare, previousMetrics.negativeShare),
    pendingReviews: buildComparisonMetric(currentMetrics.pendingReviews, previousMetrics.pendingReviews),
    reviewedReviews: buildComparisonMetric(currentMetrics.reviewedReviews, previousMetrics.reviewedReviews),
    respondedReviews: buildComparisonMetric(currentMetrics.respondedReviews, previousMetrics.respondedReviews),
    activeSources: buildComparisonMetric(currentMetrics.activeSources, previousMetrics.activeSources),
    totalRevenue: buildComparisonMetric(
      currentView.summary.totalRevenue,
      previousSalesSummary.totalRevenue
    ),
    totalOrders: buildComparisonMetric(
      currentView.summary.totalOrders,
      previousSalesSummary.totalOrders
    ),
    averageOrderValue: buildComparisonMetric(
      currentView.summary.averageOrderValue,
      previousSalesSummary.averageOrderValue
    ),
    refundCount: buildComparisonMetric(
      currentView.summary.refundCount,
      previousSalesSummary.refundCount
    ),
    refundValue: buildComparisonMetric(
      currentView.summary.refundValue,
      previousSalesSummary.refundValue
    ),
    refundRate: buildComparisonMetric(
      currentView.summary.refundRate,
      previousSalesSummary.refundRate
    ),
  };
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

function buildTrendFromComparisonMetric(
  metric: DashboardComparisonMetric,
  range: DashboardTimeRange,
  fixedOneDecimal: boolean,
  suffix = ""
): DashboardMetric["trend"] | undefined {
  if (range === "all") {
    return undefined;
  }

  return buildTrend(
    metric.current ?? 0,
    metric.previous ?? 0,
    range,
    fixedOneDecimal,
    suffix
  );
}

function buildSalesSparkline(
  salesRecords: SalesRecord[],
  metric: "revenue" | "orders" | "average-order-value" | "refund-rate",
  range: DashboardTimeRange
): number[] {
  if (salesRecords.length === 0) {
    return DEFAULT_SPARKLINE;
  }

  const records = range === "all" ? salesRecords.slice(-30) : salesRecords;
  const bins = chunkRecords(records, 6);

  return bins.map((bucket) => {
    if (bucket.length === 0) {
      return 0;
    }

    if (metric === "revenue") {
      return sumBy(bucket, (record) => record.revenue);
    }
    if (metric === "orders") {
      return sumBy(bucket, (record) => record.orders);
    }
    if (metric === "average-order-value") {
      const revenue = sumBy(bucket, (record) => record.revenue);
      const orders = sumBy(bucket, (record) => record.orders);
      return orders ? revenue / orders : 0;
    }

    const refundCount = sumBy(bucket, (record) => record.refundCount);
    const orders = sumBy(bucket, (record) => record.orders);
    return orders ? (refundCount / orders) * 100 : 0;
  });
}

function buildReviewSparkline(
  reviews: Review[],
  metric: "count" | "positive-share",
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
    if (metric === "positive-share") {
      return (
        (bucket.filter((review) => review.sentiment.label === "positive").length /
          bucket.length) *
        100
      );
    }
    return bucket.length;
  });
}

function buildReviewSparklineFromTimeSeries(
  points: DashboardReviewTimeSeriesPoint[],
  metric: "count" | "positive-share",
  range: DashboardTimeRange
): number[] {
  if (points.length === 0) {
    return DEFAULT_SPARKLINE;
  }

  const records = range === "all" ? points.slice(-30) : points;
  const bins = chunkRecords(records, 6);

  return bins.map((bucket) => {
    if (bucket.length === 0) {
      return 0;
    }

    if (metric === "positive-share") {
      const totalReviews = sumBy(bucket, (point) => point.totalReviews);
      const positiveReviews = sumBy(bucket, (point) => point.positiveReviews);
      return totalReviews ? (positiveReviews / totalReviews) * 100 : 0;
    }

    return sumBy(bucket, (point) => point.totalReviews);
  });
}

function buildReviewTimeseriesFromReviews(
  reviews: Review[],
  filters: DashboardFilters
): DashboardReviewTimeSeriesPoint[] {
  if (reviews.length === 0) {
    return [];
  }

  const relevantReviews = filterReviews(reviews, filters);
  const grouped = new Map<
    string,
    { totalReviews: number; positiveReviews: number }
  >();

  relevantReviews.forEach((review) => {
    const key = review.reviewCreatedAt.slice(0, 10);
    const current = grouped.get(key) ?? { totalReviews: 0, positiveReviews: 0 };
    current.totalReviews += 1;
    if (review.sentiment.label === "positive") {
      current.positiveReviews += 1;
    }
    grouped.set(key, current);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({
      date: `${key}T00:00:00.000Z`,
      totalReviews: value.totalReviews,
      positiveReviews: value.positiveReviews,
      positiveShare: value.totalReviews
        ? Number(((value.positiveReviews / value.totalReviews) * 100).toFixed(2))
        : 0,
    }));
}

function buildSalesSeries(salesRecords: SalesRecord[]): DashboardSalesSeriesPoint[] {
  return salesRecords.map((record) => ({
    date: record.date,
    label: formatSeriesLabel(record.date),
    revenue: record.revenue,
    orders: record.orders,
    refundValue: record.refundValue,
  }));
}

function buildChannelMix(
  salesRecords: SalesRecord[]
): DashboardSalesChannelBreakdown[] {
  const totals = salesRecords.reduce(
    (accumulator, record) => {
      (Object.keys(record.channelRevenue) as SalesChannelId[]).forEach((channelId) => {
        accumulator[channelId].revenue += record.channelRevenue[channelId];
      });
      accumulator.walk_in.orders += Math.round(record.orders * 0.3);
      accumulator.delivery_app.orders += Math.round(record.orders * 0.34);
      accumulator.instagram_dm.orders += Math.round(record.orders * 0.17);
      accumulator.whatsapp.orders += Math.max(
        0,
        record.orders -
          Math.round(record.orders * 0.3) -
          Math.round(record.orders * 0.34) -
          Math.round(record.orders * 0.17)
      );
      return accumulator;
    },
    {
      walk_in: { revenue: 0, orders: 0 },
      delivery_app: { revenue: 0, orders: 0 },
      instagram_dm: { revenue: 0, orders: 0 },
      whatsapp: { revenue: 0, orders: 0 },
    } as Record<SalesChannelId, { revenue: number; orders: number }>
  );

  const totalRevenue = sumBy(Object.values(totals), (item) => item.revenue);

  return (Object.keys(totals) as SalesChannelId[])
    .map((channelId) => ({
      id: channelId,
      revenue: totals[channelId].revenue,
      orders: totals[channelId].orders,
      share: totalRevenue ? totals[channelId].revenue / totalRevenue : 0,
    }))
    .sort((left, right) => right.revenue - left.revenue);
}

function buildTopProducts(salesRecords: SalesRecord[]): DashboardSalesProduct[] {
  const aggregate = new Map<
    string,
    { label: string; category: SalesProductCategory; revenue: number; units: number }
  >();

  for (const record of salesRecords) {
    for (const product of record.products) {
      const current = aggregate.get(product.id);
      if (current) {
        current.revenue += product.revenue;
        current.units += product.units;
      } else {
        aggregate.set(product.id, {
          label: product.label,
          category: product.category,
          revenue: product.revenue,
          units: product.units,
        });
      }
    }
  }

  const totalRevenue = sumBy(Array.from(aggregate.values()), (item) => item.revenue);

  return Array.from(aggregate.entries())
    .map(([id, value]) => ({
      id,
      label: value.label,
      category: value.category,
      revenue: value.revenue,
      units: value.units,
      share: totalRevenue ? value.revenue / totalRevenue : 0,
    }))
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 4);
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

function buildSalesSummaryFromRecords(
  salesRecords: SalesRecord[]
): DashboardSalesSummary {
  const totalRevenue = sumBy(salesRecords, (record) => record.revenue);
  const totalOrders = sumBy(salesRecords, (record) => record.orders);
  const refundCount = sumBy(salesRecords, (record) => record.refundCount);
  const refundValue = sumBy(salesRecords, (record) => record.refundValue);
  const averageOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
  const refundRate = totalOrders ? (refundCount / totalOrders) * 100 : 0;

  return {
    totalRevenue,
    totalOrders,
    averageOrderValue,
    refundCount,
    refundValue,
    refundRate,
  };
}

function buildComparisonMetric(
  current: number | null,
  previous: number | null
): DashboardComparisonMetric {
  const normalizedCurrent = current ?? 0;
  const normalizedPrevious = previous ?? 0;
  const delta = normalizedCurrent - normalizedPrevious;

  return {
    current,
    previous,
    delta,
    percentageChange: normalizedPrevious
      ? Number(((delta / normalizedPrevious) * 100).toFixed(2))
      : null,
  };
}

function sumBy<T>(items: T[], resolver: (item: T) => number): number {
  return items.reduce((sum, item) => sum + resolver(item), 0);
}

function chunkRecords<T>(records: T[], chunkCount: number): T[][] {
  if (records.length === 0) {
    return Array.from({ length: chunkCount }, () => []);
  }

  const chunks = Array.from({ length: chunkCount }, () => [] as T[]);
  const size = Math.max(1, Math.ceil(records.length / chunkCount));

  records.forEach((record, index) => {
    const chunkIndex = Math.min(chunkCount - 1, Math.floor(index / size));
    chunks[chunkIndex].push(record);
  });

  return chunks;
}

function formatSeriesLabel(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function toUtcDay(value: string): Date {
  const date = new Date(value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function toUtcDateKey(value: string): string {
  return toUtcDay(value).toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatCurrencyCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
