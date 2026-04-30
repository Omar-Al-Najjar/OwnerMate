"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SectionHeader } from "@/components/common/section-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/forms/button";
import { Select } from "@/components/forms/select";
import {
  DEFAULT_DASHBOARD_FILTERS,
  getDashboardView,
  normalizeTimeSeriesData,
} from "@/lib/dashboard/derive";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/formatters";
import type {
  DashboardActivityItem,
  DashboardDistributionBucket,
  DashboardFilters,
  DashboardMetric,
  DashboardPayload,
  DashboardPriorityReview,
  DashboardSalesChannelBreakdown,
  DashboardSalesProduct,
  DashboardSalesSeriesPoint,
  DashboardTimeRange,
  DashboardView,
  SalesChannelId,
  SalesProductCategory,
} from "@/types/dashboard";

type DashboardWorkspaceProps = {
  locale: string;
  dictionary: Dictionary;
  data: DashboardPayload | null;
  mode?: "overview" | "sales-detail" | "review-insights-detail";
};

const METRIC_TONE_STYLES: Record<
  NonNullable<DashboardMetric["tone"]> | "default",
  string
> = {
  default: "border-border bg-card/95 dark:bg-card/90",
  positive:
    "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/25",
  warning:
    "border-amber-200 bg-amber-50/70 dark:border-amber-900/70 dark:bg-amber-950/20",
  negative:
    "border-red-200 bg-red-50/70 dark:border-red-900/70 dark:bg-red-950/20",
};

const BUCKET_BAR_STYLES: Record<
  NonNullable<DashboardDistributionBucket["tone"]> | "default",
  string
> = {
  default: "bg-primary/80",
  positive: "bg-emerald-500",
  neutral: "bg-slate-400",
  negative: "bg-red-500",
  warning: "bg-amber-500",
};

const CHANNEL_TONE_STYLES: Record<SalesChannelId, string> = {
  walk_in: "bg-sky-500",
  delivery_app: "bg-emerald-500",
  instagram_dm: "bg-amber-500",
  whatsapp: "bg-primary",
};

const ACTIVITY_TONE_STYLES: Record<DashboardActivityItem["type"], string> = {
  new_review: "bg-primary",
  negative_alert: "bg-red-500",
  review_resolved: "bg-slate-400",
  positive_signal: "bg-emerald-500",
};

const CHART_RESET_BUTTON_CLASS =
  "rounded-full border border-primary/15 bg-primary/8 px-4 py-2 text-foreground shadow-sm hover:border-primary/30 hover:bg-primary/12 hover:text-foreground dark:bg-primary/10 dark:hover:bg-primary/15";

function ChartLegend({
  items,
}: {
  items: Array<{ label: string; colorClass: string }>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
      {items.map((item) => (
        <div className="inline-flex items-center gap-2" key={item.label}>
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full shadow-sm",
              item.colorClass
            )}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

const PRIORITY_BADGE_STYLES: Record<DashboardPriorityReview["priority"], string> = {
  high: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300",
  medium:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  low: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
};

function serializeFilters(filters: DashboardFilters) {
  return JSON.stringify(filters);
}

function isAllowedValue<T extends string>(
  value: string | null,
  allowedValues: readonly T[]
): value is T {
  return value !== null && allowedValues.includes(value as T);
}

function getFiltersFromSearchParams(
  searchParams: URLSearchParams,
  data: DashboardPayload
): DashboardFilters {
  const rangeParam = searchParams.get("range");
  const sourceParam = searchParams.get("source");
  const languageParam = searchParams.get("language");
  const sentimentParam = searchParams.get("sentiment");

  return {
    range: isAllowedValue(rangeParam, data.filterOptions.timeRanges)
      ? rangeParam
      : DEFAULT_DASHBOARD_FILTERS.range,
    source: isAllowedValue(sourceParam, data.filterOptions.sources)
      ? sourceParam
      : DEFAULT_DASHBOARD_FILTERS.source,
    language: isAllowedValue(languageParam, data.filterOptions.languages)
      ? languageParam
      : DEFAULT_DASHBOARD_FILTERS.language,
    sentiment: isAllowedValue(sentimentParam, data.filterOptions.sentiments)
      ? sentimentParam
      : DEFAULT_DASHBOARD_FILTERS.sentiment,
  };
}

export function DashboardWorkspace({
  locale,
  dictionary,
  data,
  mode = "overview",
}: DashboardWorkspaceProps) {
  const isRTL = locale === "ar";
  const pathname = usePathname();
  const [filters, setFilters] = useState<DashboardFilters>(
    DEFAULT_DASHBOARD_FILTERS
  );
  const [numberDisplayMode, setNumberDisplayMode] = useState<"compact" | "full">(
    "full"
  );
  const [selectedSalesPointDate, setSelectedSalesPointDate] = useState<string | null>(
    null
  );
  const [salesChartResetToken, setSalesChartResetToken] = useState(0);

  useEffect(() => {
    if (!data) {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const nextFilters = getFiltersFromSearchParams(searchParams, data);

    setFilters((current) =>
      serializeFilters(current) === serializeFilters(nextFilters)
        ? current
        : nextFilters
    );
  }, [data, pathname]);

  useEffect(() => {
    if (!data) {
      return;
    }

    const nextSearchParams = new URLSearchParams();

    if (filters.range !== DEFAULT_DASHBOARD_FILTERS.range) {
      nextSearchParams.set("range", filters.range);
    }
    if (filters.source !== "all") {
      nextSearchParams.set("source", filters.source);
    }
    if (filters.language !== "all") {
      nextSearchParams.set("language", filters.language);
    }
    if (filters.sentiment !== "all") {
      nextSearchParams.set("sentiment", filters.sentiment);
    }

    const nextUrl = nextSearchParams.toString()
      ? `${pathname}?${nextSearchParams.toString()}`
      : pathname;
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl as Route);
    }
  }, [data, filters, pathname]);

  const view = useMemo<DashboardView | null>(() => {
    if (!data) {
      return null;
    }

    return getDashboardView(data.reviews, data.salesRecords, filters);
  }, [data, filters]);

  const normalizedRevenueSeries = useMemo(
    () =>
      view ? normalizeTimeSeriesData(view.sales.revenueSeries, filters.range) : [],
    [filters.range, view]
  );
  const normalizedRefundSeries = useMemo(
    () =>
      view ? normalizeTimeSeriesData(view.sales.refundSeries, filters.range) : [],
    [filters.range, view]
  );

  useEffect(() => {
    if (!normalizedRevenueSeries.length) {
      setSelectedSalesPointDate(null);
      return;
    }

    setSelectedSalesPointDate((current) => {
      if (
        current &&
        normalizedRevenueSeries.some((point) => point.date === current)
      ) {
        return current;
      }

      return null;
    });
  }, [normalizedRevenueSeries]);

  const activeFilterCount = [
    filters.range !== DEFAULT_DASHBOARD_FILTERS.range ? filters.range : "",
    filters.source !== "all" ? filters.source : "",
    filters.language !== "all" ? filters.language : "",
    filters.sentiment !== "all" ? filters.sentiment : "",
  ].filter(Boolean).length;

  const reviewLabels = {
    sentiment: dictionary.sentimentLabels,
    status: dictionary.statusLabels,
    language: dictionary.languageNames,
  };

  if (!data || !view) {
    return (
      <div className="space-y-8">
        <SectionHeader
          description={dictionary.dashboard.description}
          eyebrow={dictionary.navigation.dashboard}
          title={dictionary.dashboard.title}
        />
        <ErrorState
          description={dictionary.dashboard.errorDescription}
          title={dictionary.dashboard.errorTitle}
        />
      </div>
    );
  }

  const rangeLabel = getRangeLabel(filters.range, dictionary);
  const hasSalesData =
    data.capabilities.salesDataAvailable && data.salesRecords.length > 0;
  const executiveMetrics = hasSalesData
    ? view.sales.executiveMetrics
    : view.sales.executiveMetrics.filter(
        (metric) =>
          metric.id === "total_reviews" || metric.id === "positive_share"
      );
  const sourceLabel =
    filters.source === "all" ? dictionary.dashboard.allSources : filters.source;
  const languageLabel =
    filters.language === "all"
      ? dictionary.dashboard.allLanguages
      : dictionary.languageNames[filters.language];
  const sentimentLabel =
    filters.sentiment === "all"
      ? dictionary.dashboard.allSentiments
      : dictionary.sentimentLabels[filters.sentiment];
  const selectedSalesPoint =
    normalizedRevenueSeries.find((point) => point.date === selectedSalesPointDate) ??
    null;
  const salesAnalyticsHref = `/${locale}/dashboard/sales` as Route;
  const reviewInsightsHref = `/${locale}/dashboard/reviews/insights` as Route;
  const reviewQueueHref = `/${locale}/reviews?sentiment=negative` as Route;
  const reviewsHref = `/${locale}/reviews` as Route;
  const queuePreview = view.review.priorityReviews.slice(0, 2);
  const activityPreview = view.review.activityFeed.slice(0, 3);
  const latestReviewInsight =
    view.review.priorityReviews[0] ?? view.review.recentReviews[0] ?? null;
  const latestRevenuePoint =
    normalizedRevenueSeries[normalizedRevenueSeries.length - 1] ?? null;
  const pageTitle =
    mode === "sales-detail"
      ? dictionary.dashboard.salesPerformance
      : mode === "review-insights-detail"
        ? dictionary.dashboard.reviewInsights
        : dictionary.dashboard.title;
  const pageDescription =
    mode === "sales-detail"
      ? dictionary.dashboard.salesPerformanceDescription
      : mode === "review-insights-detail"
        ? dictionary.dashboard.reviewInsightsDescription
        : dictionary.dashboard.description;

  const handleClearFilters = () => {
    setFilters(DEFAULT_DASHBOARD_FILTERS);
    setSelectedSalesPointDate(null);
    setSalesChartResetToken((current) => current + 1);
  };

  return (
    <div className="space-y-8" dir={isRTL ? "rtl" : "ltr"}>
      <SectionHeader
        description={pageDescription}
        eyebrow={dictionary.navigation.dashboard}
        title={pageTitle}
      />

      {mode === "overview" ? (
        <section className="soft-panel relative overflow-hidden p-6 sm:p-8">
          <div className="absolute -top-8 end-8 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute bottom-0 start-10 h-28 w-28 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="absolute end-1/3 top-1/2 h-24 w-24 rounded-full bg-amber-300/15 blur-3xl" />
          <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="space-y-5">
              <div className="space-y-3 text-start">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                  {dictionary.dashboard.heroEyebrow}
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {dictionary.dashboard.heroTitle}
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">
                  {dictionary.dashboard.heroDescription}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 font-medium text-primary">
                  {dictionary.dashboard.activeNow}
                </span>
                <span className="inline-flex items-center rounded-full border border-border bg-background/80 px-3 py-1.5 text-muted">
                  {dictionary.dashboard.focusWindow}: {rangeLabel}
                </span>
                {hasSalesData ? (
                  <span className="inline-flex items-center rounded-full border border-border bg-background/80 px-3 py-1.5 text-muted">
                    {dictionary.dashboard.totalRevenue}:{" "}
                    {formatCurrencyValue(
                      view.sales.summary.totalRevenue,
                      numberDisplayMode
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                    {data.capabilities.salesDataNote ??
                      dictionary.dashboard.noSalesDataTitle}
                  </span>
                )}
                <span className="inline-flex items-center rounded-full border border-border bg-background/80 px-3 py-1.5 text-muted">
                  {formatCountValue(view.review.reviewCount, numberDisplayMode)}{" "}
                  {dictionary.dashboard.reviewsInScope}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {hasSalesData ? (
                <HeroSummaryCard
                  helper={dictionary.dashboard.salesPerformanceDescription}
                  label={dictionary.dashboard.totalRevenue}
                  value={formatCurrencyValue(
                    view.sales.summary.totalRevenue,
                    numberDisplayMode
                  )}
                />
              ) : (
                <HeroSummaryCard
                  helper={
                    data.capabilities.salesDataNote ??
                    dictionary.dashboard.noSalesDataDescription
                  }
                  label={dictionary.dashboard.salesPerformance}
                  value={dictionary.dashboard.noSalesDataTitle}
                />
              )}
              <HeroSummaryCard
                helper={dictionary.dashboard.reviewVolume}
                label={dictionary.dashboard.focusWindow}
                value={rangeLabel}
              />
              {hasSalesData ? (
                <HeroSummaryCard
                  helper={dictionary.dashboard.filterSummary}
                  label={dictionary.dashboard.totalOrders}
                  value={formatCountValue(
                    view.sales.summary.totalOrders,
                    numberDisplayMode
                  )}
                />
              ) : (
                <HeroSummaryCard
                  helper={dictionary.dashboard.reviewVolume}
                  label={dictionary.dashboard.totalReviews}
                  value={formatCountValue(
                    view.review.reviewCount,
                    numberDisplayMode
                  )}
                />
              )}
              <HeroSummaryCard
                helper={`${sourceLabel} | ${languageLabel}`}
                label={dictionary.dashboard.sentimentFilter}
                value={sentimentLabel}
              />
            </div>
          </div>
        </section>
      ) : null}

      <DashboardFiltersPanel
        activeFilterCount={activeFilterCount}
        data={data}
        dictionary={dictionary}
        filters={filters}
        locale={locale}
        numberDisplayMode={numberDisplayMode}
        onClearFilters={handleClearFilters}
        onUpdateFilters={setFilters}
        reviewCount={view.review.reviewCount}
      />

      {mode === "overview" ? (
        <>
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <SectionLead
                description={dictionary.dashboard.executiveSummaryDescription}
                title={dictionary.dashboard.executiveSummary}
              />
              <div className="inline-flex w-fit rounded-full border border-border bg-background p-1">
                {(["full", "compact"] as const).map((displayMode) => (
                  <button
                    className={cn(
                      "cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15",
                      numberDisplayMode === displayMode
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted hover:-translate-y-px hover:bg-surface hover:text-foreground"
                    )}
                    key={displayMode}
                    onClick={() => setNumberDisplayMode(displayMode)}
                    type="button"
                  >
                    {getLocalizedNumberDisplayModeLabel(locale, displayMode)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {executiveMetrics.map((metric) => (
                <MetricCard
                  dictionary={dictionary}
                  key={metric.id}
                  metric={metric}
                  numberDisplayMode={numberDisplayMode}
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <SectionLead
                description={dictionary.dashboard.salesPerformanceDescription}
                title={dictionary.dashboard.salesPerformance}
              />
              <SectionCtaLink href={salesAnalyticsHref}>
                {dictionary.dashboard.viewFullSalesAnalytics}
              </SectionCtaLink>
            </div>
            {hasSalesData ? (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_18rem]">
                <RevenueTrendPanel
                  key={`revenue-${salesChartResetToken}-${filters.range}`}
                  dictionary={dictionary}
                  locale={locale}
                  onResetSelectedPoint={() => setSelectedSalesPointDate(null)}
                  points={normalizedRevenueSeries}
                  numberDisplayMode={numberDisplayMode}
                  onSelectPoint={setSelectedSalesPointDate}
                  selectedPoint={selectedSalesPoint}
                  range={filters.range}
                />
                <PreviewInsightCard
                  title={dictionary.dashboard.focusWindow}
                  subtitle={rangeLabel}
                >
                  <PreviewMetricRow
                    label={dictionary.dashboard.totalRevenue}
                    value={formatCurrencyValue(
                      view.sales.summary.totalRevenue,
                      numberDisplayMode
                    )}
                  />
                  <PreviewMetricRow
                    label={dictionary.dashboard.totalOrders}
                    value={formatCountValue(
                      view.sales.summary.totalOrders,
                      numberDisplayMode
                    )}
                  />
                  {latestRevenuePoint ? (
                    <PreviewMetricRow
                      label={dictionary.dashboard.revenueTrend}
                      value={`${latestRevenuePoint.label} · ${formatCurrencyValue(
                        latestRevenuePoint.revenue,
                        numberDisplayMode
                      )}`}
                    />
                  ) : null}
                </PreviewInsightCard>
              </div>
            ) : (
              <EmptyState
                description={
                  data.capabilities.salesDataNote ??
                  dictionary.dashboard.noSalesDataDescription
                }
                title={dictionary.dashboard.noSalesDataTitle}
              />
            )}
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <SectionLead
                description={dictionary.dashboard.reviewInsightsDescription}
                title={dictionary.dashboard.reviewInsights}
              />
              <SectionCtaLink href={reviewInsightsHref}>
                {dictionary.dashboard.exploreReviewInsights}
              </SectionCtaLink>
            </div>
            {view.review.reviewCount === 0 ? (
              <EmptyState
                description={dictionary.dashboard.noReviewsInViewDescription}
                title={dictionary.dashboard.noReviewsInViewTitle}
              />
            ) : (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_18rem]">
                <SentimentPanel
                  buckets={view.review.distributions.sentiment}
                  dictionary={dictionary}
                  isRTL={isRTL}
                />
                <PreviewInsightCard
                  title={dictionary.dashboard.recentReviewsTitle}
                  subtitle={dictionary.dashboard.recentReviewsDescription}
                >
                  {latestReviewInsight ? (
                    <>
                      <p className="text-sm font-semibold text-foreground">
                        {latestReviewInsight.reviewerName}
                      </p>
                      <p className="text-sm leading-6 text-muted">
                        {latestReviewInsight.reviewText}
                      </p>
                      <PreviewMetricRow
                        label={dictionary.dashboard.sentimentSummary}
                        value={
                          "sentiment" in latestReviewInsight
                            ? dictionary.sentimentLabels[
                                latestReviewInsight.sentiment.label
                              ]
                            : dictionary.sentimentLabels.negative
                        }
                      />
                    </>
                  ) : (
                    <p className="text-sm text-muted">
                      {dictionary.dashboard.noReviewsInViewDescription}
                    </p>
                  )}
                </PreviewInsightCard>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <SectionLead
              description={dictionary.dashboard.operationalPulseDescription}
              title={dictionary.dashboard.operationalPulse}
            />
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <PriorityQueuePanel
                dictionary={dictionary}
                locale={locale}
                reviews={queuePreview}
              />
              <ActivityFeedPanel
                dictionary={dictionary}
                items={activityPreview}
                locale={locale}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <SectionCtaLink href={reviewQueueHref}>
                {dictionary.dashboard.openReviewQueue}
              </SectionCtaLink>
              <SectionCtaLink href={reviewsHref} variant="secondary">
                {dictionary.dashboard.viewAllReviews}
              </SectionCtaLink>
            </div>
          </section>
        </>
      ) : null}

      {mode === "sales-detail" ? (
        hasSalesData ? (
          <>
            <section className="space-y-4">
              <SectionLead
                description={dictionary.dashboard.salesPerformanceDescription}
                title={dictionary.dashboard.salesPerformance}
              />
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <RevenueTrendPanel
                  key={`revenue-${salesChartResetToken}-${filters.range}`}
                  dictionary={dictionary}
                  locale={locale}
                  onResetSelectedPoint={() => setSelectedSalesPointDate(null)}
                  points={normalizedRevenueSeries}
                  numberDisplayMode={numberDisplayMode}
                  onSelectPoint={setSelectedSalesPointDate}
                  selectedPoint={selectedSalesPoint}
                  range={filters.range}
                />
                <ChannelMixPanel
                  channels={view.sales.channelMix}
                  dictionary={dictionary}
                  isRTL={isRTL}
                  numberDisplayMode={numberDisplayMode}
                />
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <OrdersRevenuePanel
                key={`orders-${salesChartResetToken}-${filters.range}`}
                dictionary={dictionary}
                isRTL={isRTL}
                locale={locale}
                onResetSelectedPoint={() => setSelectedSalesPointDate(null)}
                points={normalizedRevenueSeries}
                numberDisplayMode={numberDisplayMode}
                onSelectPoint={setSelectedSalesPointDate}
                selectedPoint={selectedSalesPoint}
                range={filters.range}
              />
              <RefundPanel
                key={`refund-${salesChartResetToken}-${filters.range}`}
                dictionary={dictionary}
                isRTL={isRTL}
                locale={locale}
                onResetSelectedPoint={() => setSelectedSalesPointDate(null)}
                onSelectPoint={setSelectedSalesPointDate}
                points={normalizedRefundSeries}
                numberDisplayMode={numberDisplayMode}
                selectedPoint={selectedSalesPoint}
                summary={view.sales.summary}
                range={filters.range}
              />
            </section>

            <TopProductsPanel
              dictionary={dictionary}
              isRTL={isRTL}
              numberDisplayMode={numberDisplayMode}
              products={view.sales.topProducts}
            />
          </>
        ) : (
          <EmptyState
            description={
              data.capabilities.salesDataNote ??
              dictionary.dashboard.noSalesDataDescription
            }
            title={dictionary.dashboard.noSalesDataTitle}
          />
        )
      ) : null}

      {mode === "review-insights-detail" ? (
        view.review.reviewCount === 0 ? (
          <EmptyState
            description={dictionary.dashboard.noReviewsInViewDescription}
            title={dictionary.dashboard.noReviewsInViewTitle}
          />
        ) : (
          <>
            <section className="space-y-4">
              <SectionLead
                description={dictionary.dashboard.reviewInsightsDescription}
                title={dictionary.dashboard.reviewInsights}
              />
              <SentimentPanel
                buckets={view.review.distributions.sentiment}
                dictionary={dictionary}
                isRTL={isRTL}
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <DistributionPanel
                buckets={view.review.distributions.ratings}
                description={dictionary.dashboard.sentimentHelper}
                dictionary={dictionary}
                isRTL={isRTL}
                title={dictionary.dashboard.ratingMix}
                variant="rating"
              />
              <DistributionPanel
                buckets={view.review.distributions.sources}
                description={dictionary.dashboard.sourcesHelper}
                dictionary={dictionary}
                isRTL={isRTL}
                title={dictionary.dashboard.sourceMix}
                variant="source"
              />
              <DistributionPanel
                buckets={view.review.distributions.languages}
                description={dictionary.common.language}
                dictionary={dictionary}
                isRTL={isRTL}
                title={dictionary.dashboard.languageMix}
                variant="language"
              />
            </section>
          </>
        )
      ) : null}
    </div>
  );
}

function HeroSummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-background/85 p-4 text-start shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-panel">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-3 text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted">{helper}</p>
    </div>
  );
}

function SectionLead({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1 text-start">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted">{description}</p>
    </div>
  );
}

function SectionCtaLink({
  href,
  children,
  variant = "primary",
}: {
  href: Route;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        variant === "primary"
          ? "bg-primary text-white shadow-sm hover:-translate-y-px hover:bg-primary-hover"
          : "border border-border bg-background text-foreground hover:-translate-y-px hover:border-primary/30 hover:bg-surface"
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

function PreviewInsightCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="panel h-fit space-y-4 p-5">
      <div className="space-y-1 text-start">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </aside>
  );
}

function PreviewMetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-3 text-start">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ExpandChartButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Expand chart"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-all duration-200 hover:-translate-y-px hover:border-primary/30 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      onClick={onClick}
      title="Expand chart"
      type="button"
    >
      <span aria-hidden="true" className="text-base leading-none">
        ⛶
      </span>
    </button>
  );
}

function CloseChartButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Close chart"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-all duration-200 hover:-translate-y-px hover:border-primary/30 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      onClick={onClick}
      title="Close chart"
      type="button"
    >
      <span aria-hidden="true" className="text-lg leading-none">
        ×
      </span>
    </button>
  );
}

function ChartModal({
  children,
  isOpen,
  onClose,
  title,
}: {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="flex h-[min(90vh,760px)] w-[min(95vw,1200px)] flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="space-y-1 text-start">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          </div>
          <CloseChartButton onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function DashboardFiltersPanel({
  activeFilterCount,
  data,
  dictionary,
  filters,
  locale,
  numberDisplayMode,
  onClearFilters,
  onUpdateFilters,
  reviewCount,
}: {
  activeFilterCount: number;
  data: DashboardPayload;
  dictionary: Dictionary;
  filters: DashboardFilters;
  locale: string;
  numberDisplayMode: "compact" | "full";
  onClearFilters: () => void;
  onUpdateFilters: React.Dispatch<React.SetStateAction<DashboardFilters>>;
  reviewCount: number;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-panel">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3 text-start">
          <p className="text-sm font-semibold text-foreground">
            {dictionary.dashboard.filterSummary}
          </p>
          <p className="text-sm text-muted">
            {dictionary.dashboard.reviewsInScope}:{" "}
            {formatCountValue(reviewCount, numberDisplayMode)}
          </p>
          <p className="text-xs text-muted">
            {activeFilterCount > 0
              ? getLocalizedActiveFilterSummary(
                  locale,
                  activeFilterCount,
                  numberDisplayMode
                )
              : dictionary.dashboard.datasetBaseline}
          </p>
          <div className="flex flex-wrap gap-2">
            {data.filterOptions.timeRanges.map((range) => {
              const isActive = filters.range === range;

              return (
                <button
                  className={cn(
                    "cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15",
                    isActive
                      ? "border-primary bg-primary text-white shadow-sm"
                      : "border-border bg-background text-foreground hover:-translate-y-px hover:border-primary/40 hover:bg-surface hover:shadow-sm"
                  )}
                  key={range}
                  onClick={() =>
                    onUpdateFilters((current) => ({ ...current, range }))
                  }
                  type="button"
                >
                  {getRangeLabel(range, dictionary)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Select
            label={dictionary.dashboard.sourceFilter}
            onChange={(event) =>
              onUpdateFilters((current) => ({
                ...current,
                source: event.target.value,
              }))
            }
            options={[
              {
                label: dictionary.dashboard.allSources,
                value: "all",
              },
              ...data.filterOptions.sources.map((source) => ({
                label: source,
                value: source,
              })),
            ]}
            value={filters.source}
          />
          <Select
            label={dictionary.dashboard.languageFilter}
            onChange={(event) =>
              onUpdateFilters((current) => ({
                ...current,
                language: event.target.value as DashboardFilters["language"],
              }))
            }
            options={[
              {
                label: dictionary.dashboard.allLanguages,
                value: "all",
              },
              ...data.filterOptions.languages.map((language) => ({
                label: dictionary.languageNames[language],
                value: language,
              })),
            ]}
            value={filters.language}
          />
          <Select
            label={dictionary.dashboard.sentimentFilter}
            onChange={(event) =>
              onUpdateFilters((current) => ({
                ...current,
                sentiment: event.target.value as DashboardFilters["sentiment"],
              }))
            }
            options={[
              {
                label: dictionary.dashboard.allSentiments,
                value: "all",
              },
              ...data.filterOptions.sentiments.map((sentiment) => ({
                label: dictionary.sentimentLabels[sentiment],
                value: sentiment,
              })),
            ]}
            value={filters.sentiment}
          />
          <div className="flex items-end">
            <Button
              className="w-full rounded-xl border border-border bg-surface text-foreground shadow-none hover:bg-slate-100 dark:bg-slate-900/70 dark:hover:bg-slate-800 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-100 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-400"
              disabled={activeFilterCount === 0}
              onClick={onClearFilters}
              type="button"
              variant="secondary"
            >
              {dictionary.dashboard.clearFilters}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  metric,
  dictionary,
  numberDisplayMode,
}: {
  metric: DashboardMetric;
  dictionary: Dictionary;
  numberDisplayMode: "compact" | "full";
}) {
  const tone = metric.tone ?? "default";
  const trendTone =
    metric.trend?.direction === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : metric.trend?.direction === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted";

  return (
    <article
      className={cn(
        "rounded-2xl border p-5 shadow-panel transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg",
        METRIC_TONE_STYLES[tone]
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2 text-start">
          <p className="text-sm font-medium text-muted">
            {getMetricLabel(metric.id, dictionary)}
          </p>
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {formatMetricValue(metric, numberDisplayMode)}
          </p>
        </div>
        <Sparkline values={metric.sparkline} />
      </div>

      <div className="mt-4 space-y-2 text-start">
        <p className="text-sm text-muted">
          {getMetricContextLabel(metric, dictionary)}
        </p>
        <p className={cn("text-sm font-medium", trendTone)}>
          {metric.trend
            ? `${formatMetricTrend(metric, numberDisplayMode)} ${dictionary.dashboard.vsPreviousWindow}`
            : dictionary.dashboard.datasetBaseline}
        </p>
      </div>
    </article>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const pointCount = values.length;
  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;
  const points = values
    .map((value, index) => {
      const x = pointCount === 1 ? 50 : (index / (pointCount - 1)) * 100;
      const y = 32 - ((value - minValue) / range) * 24;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      aria-hidden="true"
      className="h-12 w-24 text-primary/80"
      fill="none"
      viewBox="0 0 100 36"
    >
      <path
        d="M0 34H100"
        stroke="currentColor"
        strokeDasharray="4 4"
        strokeOpacity="0.16"
      />
      <polyline
        points={points}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function RevenueTrendPanel({
  points,
  dictionary,
  locale,
  selectedPoint,
  onSelectPoint,
  onResetSelectedPoint,
  numberDisplayMode,
  range,
}: {
  points: DashboardSalesSeriesPoint[];
  dictionary: Dictionary;
  locale: string;
  selectedPoint: DashboardSalesSeriesPoint | null;
  onSelectPoint: (date: string) => void;
  onResetSelectedPoint: () => void;
  numberDisplayMode: "compact" | "full";
  range: DashboardTimeRange;
}) {
  const activePoint = selectedPoint ?? points[points.length - 1] ?? null;
  const [isExpanded, setIsExpanded] = useState(false);
  const renderChart = (expanded: boolean) => (
    <div className="space-y-4">
      <ChartLegend
        items={[
          {
            colorClass: "bg-primary",
            label: dictionary.dashboard.revenueLabel,
          },
        ]}
      />
      <div className={cn(expanded && "overflow-x-auto")} dir="ltr">
        <div className={cn(expanded && "min-w-[720px]")}>
          <LineAreaChart
            colorClass="text-primary"
            containerClassName={expanded ? "px-4 py-6" : undefined}
            formatTooltipValue={(point) =>
              formatCurrencyValue(point.revenue, numberDisplayMode)
            }
            locale={locale}
            onSelectPoint={onSelectPoint}
            points={points}
            selectedDate={selectedPoint?.date ?? null}
            svgClassName={expanded ? "h-[26rem]" : undefined}
            valueSelector={(point) => point.revenue}
          />
        </div>
      </div>
      <div
        className="flex items-center justify-between gap-3 text-xs text-muted"
        dir="ltr"
      >
        <span>
          {points[0] ? formatChartDate(points[0].date, locale) : ""}
        </span>
        <span>
          {points[Math.floor(points.length / 2)]
            ? formatChartDate(points[Math.floor(points.length / 2)].date, locale)
            : ""}
        </span>
        <span>
          {points[points.length - 1]
            ? formatChartDate(points[points.length - 1].date, locale)
            : ""}
        </span>
      </div>
      {activePoint ? (
        <div className="rounded-2xl border border-border bg-background p-4 text-start transition-all duration-200 hover:border-primary/20 hover:shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            {formatChartDate(activePoint.date, locale)}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {formatCurrencyValue(activePoint.revenue, numberDisplayMode)}
          </p>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <section className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 text-start">
            <h3 className="text-lg font-semibold text-foreground">
              {dictionary.dashboard.revenueTrend}
            </h3>
            <p className="text-sm text-muted">
              {dictionary.dashboard.revenueTrendDescription}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedPoint ? (
              <Button
                className={CHART_RESET_BUTTON_CLASS}
                onClick={onResetSelectedPoint}
                type="button"
              >
                {dictionary.dashboard.resetSelectedTime}
              </Button>
            ) : null}
            <ExpandChartButton onClick={() => setIsExpanded(true)} />
          </div>
        </div>
        {points.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              description={dictionary.dashboard.noSalesDataDescription}
              title={dictionary.dashboard.noSalesDataTitle}
            />
          </div>
        ) : (
          <div className="mt-5">{renderChart(false)}</div>
        )}
      </section>
      <ChartModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        title={`${dictionary.dashboard.revenueTrend} · ${getRangeLabel(range, dictionary)}`}
      >
        {renderChart(true)}
      </ChartModal>
    </>
  );
}

function OrdersRevenuePanel({
  points,
  dictionary,
  isRTL,
  locale,
  selectedPoint,
  onSelectPoint,
  onResetSelectedPoint,
  numberDisplayMode,
  range,
}: {
  points: DashboardSalesSeriesPoint[];
  dictionary: Dictionary;
  isRTL: boolean;
  locale: string;
  selectedPoint: DashboardSalesSeriesPoint | null;
  onSelectPoint: (date: string) => void;
  onResetSelectedPoint: () => void;
  numberDisplayMode: "compact" | "full";
  range: DashboardTimeRange;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const getRenderedPoints = (expanded: boolean) =>
    expanded || range !== "all" ? points : points.slice(-30);
  const activePoint = (
    expanded: boolean
  ): DashboardSalesSeriesPoint | null => {
    const renderedPoints = getRenderedPoints(expanded);
    return selectedPoint &&
      renderedPoints.some((point) => point.date === selectedPoint.date)
      ? selectedPoint
      : renderedPoints[renderedPoints.length - 1] ?? null;
  };
  const renderChart = (expanded: boolean) => {
    const renderedPoints = getRenderedPoints(expanded);
    const currentPoint = activePoint(expanded);

    if (renderedPoints.length === 0) {
      return (
        <EmptyState
          description={dictionary.dashboard.noSalesDataDescription}
          title={dictionary.dashboard.noSalesDataTitle}
        />
      );
    }

    return (
      <div className="space-y-4">
        {currentPoint ? (
          <div className={cn("flex", isRTL ? "justify-start" : "justify-end")}>
            <div className="inline-flex h-fit w-fit min-w-[10rem] flex-col rounded-3xl border border-border bg-background px-3 py-2 text-start transition-all duration-200 hover:border-primary/20 hover:shadow-sm lg:min-w-[10.5rem]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                {formatChartDate(currentPoint.date, locale)}
              </p>
              <p className="mt-1.5 text-[1.05rem] font-semibold text-foreground">
                {formatCurrencyValue(currentPoint.revenue, numberDisplayMode)}
              </p>
              <p className="mt-0.5 text-[13px] text-muted">
                {formatCountValue(currentPoint.orders, numberDisplayMode)}{" "}
                {dictionary.dashboard.ordersLabel}
              </p>
            </div>
          </div>
        ) : null}
        <div className="min-w-0 space-y-3" dir="ltr">
          <ChartLegend
            items={[
              {
                colorClass: "bg-primary",
                label: dictionary.dashboard.revenueLabel,
              },
              {
                colorClass: "bg-emerald-500",
                label: dictionary.dashboard.ordersLabel,
              },
            ]}
          />
          <div className={cn(expanded && "overflow-x-auto")} dir="ltr">
            <div
              className={cn(
                expanded ? "min-w-[900px]" : "",
                renderedPoints.length > 24 && !expanded ? "min-w-[720px]" : ""
              )}
            >
              <RevenueOrdersComboChart
                dictionary={dictionary}
                expanded={expanded}
                locale={locale}
                onSelectPoint={onSelectPoint}
                numberDisplayMode={numberDisplayMode}
                points={renderedPoints}
                selectedDate={currentPoint?.date ?? null}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <section className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 text-start">
            <h3 className="text-lg font-semibold text-foreground">
              {dictionary.dashboard.ordersRevenueView}
            </h3>
            <p className="text-sm text-muted">
              {dictionary.dashboard.ordersRevenueDescription}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedPoint ? (
              <Button
                className={CHART_RESET_BUTTON_CLASS}
                onClick={onResetSelectedPoint}
                type="button"
              >
                {dictionary.dashboard.resetSelectedTime}
              </Button>
            ) : null}
            <ExpandChartButton onClick={() => setIsExpanded(true)} />
          </div>
        </div>
        <div className="mt-5">{renderChart(false)}</div>
      </section>
      <ChartModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        title={`${dictionary.dashboard.ordersRevenueView} · ${getRangeLabel(range, dictionary)}`}
      >
        {renderChart(true)}
      </ChartModal>
    </>
  );
}

function ChannelMixPanel({
  channels,
  dictionary,
  isRTL,
  numberDisplayMode,
}: {
  channels: DashboardSalesChannelBreakdown[];
  dictionary: Dictionary;
  isRTL: boolean;
  numberDisplayMode: "compact" | "full";
}) {
  return (
    <section className="panel p-6">
      <div className="space-y-1 text-start">
        <h3 className="text-lg font-semibold text-foreground">
          {dictionary.dashboard.channelMix}
        </h3>
        <p className="text-sm text-muted">
          {dictionary.dashboard.channelMixDescription}
        </p>
      </div>

      {channels.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            description={dictionary.dashboard.noSalesDataDescription}
            title={dictionary.dashboard.noSalesDataTitle}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {channels.map((channel) => (
              <div
                className="rounded-2xl border border-border bg-background p-4 text-start transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-sm"
                key={channel.id}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      CHANNEL_TONE_STYLES[channel.id]
                    )}
                  />
                  <p className="text-sm font-medium text-foreground">
                    {dictionary.dashboard.salesChannels[channel.id]}
                  </p>
                </div>
                <p className="mt-3 text-xl font-semibold text-foreground">
                  {Math.round(channel.share * 100)}%
                </p>
                <p className="mt-1 text-sm text-muted">
                  {formatCurrencyValue(channel.revenue, numberDisplayMode)}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {channels.map((channel) => (
              <div className="space-y-2" key={channel.id}>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium text-foreground">
                    {dictionary.dashboard.salesChannels[channel.id]}
                  </span>
                  <span className="text-muted">
                    {formatCountValue(channel.orders, numberDisplayMode)}{" "}
                    {dictionary.dashboard.ordersLabel}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-surface"
                  dir={isRTL ? "rtl" : "ltr"}
                >
                  <div
                    className={cn(
                      "h-full rounded-full",
                      CHANNEL_TONE_STYLES[channel.id]
                    )}
                    style={{ width: `${Math.max(channel.share * 100, 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function RefundPanel({
  points,
  summary,
  dictionary,
  isRTL,
  locale,
  selectedPoint,
  numberDisplayMode,
  onSelectPoint,
  onResetSelectedPoint,
  range,
}: {
  points: DashboardSalesSeriesPoint[];
  summary: DashboardView["sales"]["summary"];
  dictionary: Dictionary;
  isRTL: boolean;
  locale: string;
  selectedPoint: DashboardSalesSeriesPoint | null;
  numberDisplayMode: "compact" | "full";
  onSelectPoint: (date: string) => void;
  onResetSelectedPoint: () => void;
  range: DashboardTimeRange;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const getRenderedPoints = (expanded: boolean) =>
    expanded || range !== "all" ? points : points.slice(-30);
  const activePoint = (expanded: boolean) => {
    const renderedPoints = getRenderedPoints(expanded);
    return selectedPoint &&
      renderedPoints.some((point) => point.date === selectedPoint.date)
      ? selectedPoint
      : renderedPoints[renderedPoints.length - 1] ?? null;
  };
  const renderChart = (expanded: boolean) => {
    const renderedPoints = getRenderedPoints(expanded);
    const currentPoint = activePoint(expanded);

    if (renderedPoints.length === 0) {
      return (
        <EmptyState
          description={dictionary.dashboard.noSalesDataDescription}
          title={dictionary.dashboard.noSalesDataTitle}
        />
      );
    }

    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <ChartLegend
            items={[
              {
                colorClass: "bg-amber-500",
                label: dictionary.dashboard.refundsLabel,
              },
            ]}
          />
          <div className={cn(expanded && "overflow-x-auto")} dir="ltr">
            <div className={cn(expanded && "min-w-[720px]")}>
              <LineAreaChart
                colorClass="text-amber-500"
                containerClassName={expanded ? "px-4 py-6" : "px-2 py-6 lg:px-1"}
                formatTooltipValue={(point) =>
                  formatCurrencyValue(point.refundValue, numberDisplayMode)
                }
                locale={locale}
                onSelectPoint={onSelectPoint}
                points={renderedPoints}
                selectedDate={currentPoint?.date ?? null}
                svgClassName={expanded ? "h-[26rem]" : "h-64"}
                valueSelector={(point) => point.refundValue}
              />
            </div>
          </div>
        </div>
        <div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <RefundStatCard
            label={dictionary.dashboard.refundValue}
            value={formatCurrencyValue(summary.refundValue, numberDisplayMode)}
          />
          <RefundStatCard
            label={
              currentPoint
                ? formatChartDate(currentPoint.date, locale)
                : dictionary.dashboard.focusWindow
            }
            value={
              currentPoint
                ? formatCurrencyValue(currentPoint.refundValue, numberDisplayMode)
                : formatCurrencyValue(summary.refundValue, numberDisplayMode)
            }
          />
          <RefundStatCard
            label={dictionary.dashboard.refundRate}
            value={`${summary.refundRate.toFixed(1)}%`}
          />
          <RefundStatCard
            label={dictionary.dashboard.refundCount}
            value={formatCountValue(summary.refundCount, numberDisplayMode)}
          />
        </div>
      </div>
    );
  };

  return (
    <>
      <section className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 text-start">
            <h3 className="text-lg font-semibold text-foreground">
              {dictionary.dashboard.refundTrend}
            </h3>
            <p className="text-sm text-muted">
              {dictionary.dashboard.refundTrendDescription}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedPoint ? (
              <Button
                className={CHART_RESET_BUTTON_CLASS}
                onClick={onResetSelectedPoint}
                type="button"
              >
                {dictionary.dashboard.resetSelectedTime}
              </Button>
            ) : null}
            <ExpandChartButton onClick={() => setIsExpanded(true)} />
          </div>
        </div>
        <div className="mt-5">{renderChart(false)}</div>
      </section>
      <ChartModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        title={`${dictionary.dashboard.refundTrend} · ${getRangeLabel(range, dictionary)}`}
      >
        {renderChart(true)}
      </ChartModal>
    </>
  );
}

function RefundStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4 text-start transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-3 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TopProductsPanel({
  products,
  dictionary,
  isRTL,
  numberDisplayMode,
}: {
  products: DashboardSalesProduct[];
  dictionary: Dictionary;
  isRTL: boolean;
  numberDisplayMode: "compact" | "full";
}) {
  return (
    <section className="panel p-6">
      <div className="space-y-1 text-start">
        <h3 className="text-lg font-semibold text-foreground">
          {dictionary.dashboard.topProducts}
        </h3>
        <p className="text-sm text-muted">
          {dictionary.dashboard.topProductsDescription}
        </p>
      </div>
      {products.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            description={dictionary.dashboard.noSalesDataDescription}
            title={dictionary.dashboard.noSalesDataTitle}
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="space-y-3">
            {products.map((product, index) => (
              <div
                className="rounded-2xl border border-border bg-background p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-sm"
                key={product.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1 text-start">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {index + 1}
                      </span>
                      <p className="text-sm font-semibold text-foreground">
                        {product.label}
                      </p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted">
                      {dictionary.dashboard.productCategories[product.category]}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrencyValue(product.revenue, numberDisplayMode)}
                    </p>
                    <p className="text-xs text-muted">
                      {formatCountValue(product.units, numberDisplayMode)}{" "}
                      {dictionary.dashboard.unitsLabel}
                    </p>
                  </div>
                </div>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-surface"
                  dir={isRTL ? "rtl" : "ltr"}
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(product.share * 100, 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-3xl border border-border bg-background px-5 py-6 transition-all duration-200 hover:border-primary/15 hover:shadow-sm">
            <p className="text-sm font-semibold text-foreground">
              {dictionary.dashboard.productSnapshot}
            </p>
            <div className="mt-5 space-y-4">
              {aggregateProductCategories(products).map((category) => (
                <div className="space-y-2" key={category.id}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">
                      {dictionary.dashboard.productCategories[category.id]}
                    </span>
                    <span className="text-muted">
                      {formatCurrencyValue(category.revenue, numberDisplayMode)}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-surface"
                    dir={isRTL ? "rtl" : "ltr"}
                  >
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.max(category.share * 100, 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SentimentPanel({
  buckets,
  dictionary,
  isRTL,
}: {
  buckets: DashboardDistributionBucket[];
  dictionary: Dictionary;
  isRTL: boolean;
}) {
  return (
    <section className="panel p-6">
      <div className="space-y-1 text-start">
        <h3 className="text-lg font-semibold text-foreground">
          {dictionary.dashboard.sentimentSummary}
        </h3>
        <p className="text-sm text-muted">
          {dictionary.dashboard.sentimentHelper}
        </p>
      </div>

      <div
        className="mt-5 flex h-4 overflow-hidden rounded-full bg-surface"
        dir={isRTL ? "rtl" : "ltr"}
      >
        {buckets.map((bucket) => (
          <div
            className={cn(
              "h-full transition-all",
              BUCKET_BAR_STYLES[bucket.tone ?? "default"]
            )}
            key={bucket.id}
            style={{ width: `${Math.max(bucket.share * 100, 0)}%` }}
          />
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {buckets.map((bucket) => (
          <div
            className="rounded-2xl border border-border bg-background p-4 text-start transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-sm"
            key={bucket.id}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  BUCKET_BAR_STYLES[bucket.tone ?? "default"]
                )}
              />
              <p className="text-sm font-medium text-foreground">
                {getBucketLabel(bucket, dictionary, "sentiment")}
              </p>
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              {Math.round(bucket.share * 100)}%
            </p>
            <p className="mt-1 text-sm text-muted">{bucket.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DistributionPanel({
  title,
  description,
  buckets,
  dictionary,
  isRTL,
  variant,
}: {
  title: string;
  description: string;
  buckets: DashboardDistributionBucket[];
  dictionary: Dictionary;
  isRTL: boolean;
  variant: "rating" | "source" | "language" | "sentiment";
}) {
  return (
    <section className="panel p-6">
      <div className="space-y-1 text-start">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <div className="mt-5 space-y-4">
        {buckets.map((bucket) => (
          <div
            className="space-y-2 rounded-xl px-3 py-2 transition-colors duration-200 hover:bg-surface/60"
            key={bucket.id}
          >
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium text-foreground">
                {getBucketLabel(bucket, dictionary, variant)}
              </span>
              <span className="text-muted">{bucket.value}</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-surface"
              dir={isRTL ? "rtl" : "ltr"}
            >
              <div
                className={cn(
                  "h-full rounded-full",
                  BUCKET_BAR_STYLES[bucket.tone ?? "default"]
                )}
                style={{ width: `${Math.max(bucket.share * 100, 0)}%` }}
              />
            </div>
            <p className="text-xs text-muted">{Math.round(bucket.share * 100)}%</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PriorityQueuePanel({
  reviews,
  dictionary,
  locale,
}: {
  reviews: DashboardPriorityReview[];
  dictionary: Dictionary;
  locale: string;
}) {
  return (
    <section className="panel p-6">
      <div className="space-y-1 text-start">
        <h3 className="text-lg font-semibold text-foreground">
          {dictionary.dashboard.priorityQueue}
        </h3>
        <p className="text-sm text-muted">
          {dictionary.dashboard.priorityQueueDescription}
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            description={dictionary.dashboard.noPriorityDescription}
            title={dictionary.dashboard.noPriorityTitle}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {reviews.map((review) => (
            <article
              className="group rounded-2xl border border-border bg-background p-4 text-start transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-panel"
              key={review.reviewId}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="rounded-full bg-surface px-2.5 py-1 font-medium text-foreground">
                      {review.source}
                    </span>
                    <span>{formatDate(review.reviewCreatedAt, locale)}</span>
                  </div>
                  <h4 className="text-base font-semibold text-foreground">
                    {review.reviewerName}
                  </h4>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em]",
                    PRIORITY_BADGE_STYLES[review.priority]
                  )}
                >
                  {getPriorityLabel(review.priority, dictionary)}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-foreground">
                {review.reviewText}
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    {getPriorityReasonLabel(review.reason, dictionary)}
                  </p>
                  <p className="text-muted">
                    {dictionary.languageNames[review.language]} | {review.rating}/5
                  </p>
                </div>
                <Link
                  className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 font-medium text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-surface hover:text-primary group-hover:border-primary/25"
                  href={`/${locale}/reviews/${review.reviewId}` as Route}
                >
                  {dictionary.dashboard.openReviewAction}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ActivityFeedPanel({
  items,
  dictionary,
  locale,
}: {
  items: DashboardActivityItem[];
  dictionary: Dictionary;
  locale: string;
}) {
  return (
    <section className="panel p-6">
      <div className="space-y-1 text-start">
        <h3 className="text-lg font-semibold text-foreground">
          {dictionary.dashboard.activityFeed}
        </h3>
        <p className="text-sm text-muted">
          {dictionary.dashboard.activityFeedDescription}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            description={dictionary.dashboard.noActivityDescription}
            title={dictionary.dashboard.noActivityTitle}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {items.map((item) => (
            <Link
              className="group block cursor-pointer rounded-2xl border border-border bg-background p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface hover:shadow-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15"
              href={`/${locale}/reviews/${item.reviewId}` as Route}
              key={item.id}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-1.5 h-2.5 w-2.5 rounded-full",
                    ACTIVITY_TONE_STYLES[item.type]
                  )}
                />
                <div className="min-w-0 flex-1 space-y-1 text-start">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {getActivityTypeLabel(item.type, dictionary)}
                    </p>
                    <span className="text-xs text-muted">
                      {formatDate(item.occurredAt, locale)}
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    {item.reviewerName} | {item.source} | {item.rating}/5
                  </p>
                  <p className="text-xs text-muted">
                    {dictionary.languageNames[item.language]} |{" "}
                    {dictionary.sentimentLabels[item.sentiment]}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function RevenueOrdersComboChart({
  points,
  selectedDate,
  onSelectPoint,
  numberDisplayMode,
  locale,
  dictionary,
  expanded,
}: {
  points: DashboardSalesSeriesPoint[];
  selectedDate: string | null;
  onSelectPoint: (date: string) => void;
  numberDisplayMode: "compact" | "full";
  locale: string;
  dictionary: Dictionary;
  expanded?: boolean;
}) {
  const bars = points;
  const isDense = bars.length > 12;
  const isUltraDense = bars.length > 24;
  const maxRevenue = Math.max(...bars.map((point) => point.revenue), 1);
  const maxOrders = Math.max(...bars.map((point) => point.orders), 1);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const hoveredIndex = bars.findIndex((point) => point.date === hoveredDate);
  const hoveredPoint = hoveredIndex >= 0 ? bars[hoveredIndex] : null;
  const tooltipStyle =
    hoveredIndex <= 0
      ? { left: "0%", transform: "translateX(0)" }
      : hoveredIndex >= bars.length - 1
        ? { left: "100%", transform: "translateX(-100%)" }
        : {
            left: `${((hoveredIndex + 0.5) / Math.max(bars.length, 1)) * 100}%`,
            transform: "translateX(-50%)",
          };

  return (
    <div className="relative w-full rounded-3xl border border-border bg-background px-2 py-6 transition-colors duration-200 hover:border-primary/10 lg:px-1.5">
      {hoveredPoint ? (
        <div
          className="pointer-events-none absolute top-3 z-10 w-max max-w-[12rem] rounded-2xl border border-outline-variant bg-slate-950 px-3 py-2 text-start text-xs text-white shadow-xl dark:bg-slate-900"
          style={tooltipStyle}
        >
          <p className="font-semibold text-white">
            {formatChartDate(hoveredPoint.date, locale)}
          </p>
          <p className="mt-1 text-slate-200">
            {dictionary.dashboard.revenueLabel}:{" "}
            {formatCurrencyValue(hoveredPoint.revenue, numberDisplayMode)}
          </p>
          <p className="text-slate-200">
            {dictionary.dashboard.ordersLabel}:{" "}
            {formatCountValue(hoveredPoint.orders, numberDisplayMode)}
          </p>
        </div>
      ) : null}
      <div
        className={cn(
          expanded ? "flex h-[26rem] items-end" : "flex h-72 items-end",
          isUltraDense ? "gap-0.5" : isDense ? "gap-1" : "gap-3"
        )}
      >
        {bars.map((point) => (
          <button
            aria-label={`Inspect ${point.label}`}
            className={cn(
              "group flex min-w-0 flex-1 cursor-pointer flex-col items-center rounded-2xl py-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 hover:bg-surface/80",
              isUltraDense
                ? "gap-0.5 px-0.5"
                : isDense
                  ? "gap-1 px-1"
                  : "gap-2 px-2",
              selectedDate === point.date ? "bg-surface/70 shadow-sm" : "",
              hoveredDate === point.date ? "bg-surface/80 shadow-sm" : ""
            )}
            key={point.date}
            onMouseEnter={() => setHoveredDate(point.date)}
            onMouseLeave={() =>
              setHoveredDate((current) =>
                current === point.date ? null : current
              )
            }
            onClick={() => onSelectPoint(point.date)}
            type="button"
          >
            <div
              className={cn(
                "flex h-60 w-full items-end justify-center",
                isUltraDense ? "gap-px" : isDense ? "gap-0.5" : "gap-1"
              )}
            >
              <div
                className={cn(
                  "rounded-full bg-primary/85 transition-all duration-200 group-hover:opacity-100",
                  isUltraDense ? "w-1.5" : isDense ? "w-2" : "w-3",
                  selectedDate === point.date ? "ring-2 ring-primary/30" : "",
                  hoveredDate === point.date ? "bg-primary brightness-110" : ""
                )}
                style={{ height: `${(point.revenue / maxRevenue) * 100}%` }}
              />
              <div
                className={cn(
                  "rounded-full bg-emerald-500/85 transition-all duration-200 group-hover:opacity-100",
                  isUltraDense ? "w-1.5" : isDense ? "w-2" : "w-3",
                  selectedDate === point.date ? "ring-2 ring-emerald-500/30" : "",
                  hoveredDate === point.date
                    ? "bg-emerald-400 brightness-110"
                    : ""
                )}
                style={{ height: `${(point.orders / maxOrders) * 100}%` }}
              />
            </div>
            <span
              className={cn(
                "w-full text-center text-muted transition-colors duration-200",
                isUltraDense
                  ? "text-[8px] leading-tight"
                  : isDense
                    ? "text-[10px] leading-tight"
                    : "text-[11px]",
                selectedDate === point.date
                  ? "font-medium text-foreground"
                  : "group-hover:text-foreground"
              )}
            >
              {point.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LineAreaChart({
  points,
  valueSelector,
  colorClass,
  formatTooltipValue,
  locale,
  selectedDate,
  onSelectPoint,
  containerClassName,
  svgClassName,
}: {
  points: DashboardSalesSeriesPoint[];
  valueSelector: (point: DashboardSalesSeriesPoint) => number;
  colorClass: string;
  formatTooltipValue: (point: DashboardSalesSeriesPoint) => string;
  locale: string;
  selectedDate: string | null;
  onSelectPoint: (date: string) => void;
  containerClassName?: string;
  svgClassName?: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const values = points.map(valueSelector);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;
  const chartPoints = points.map((point, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 90 - ((valueSelector(point) - minValue) / range) * 72;

    return {
      ...point,
      metricValue: valueSelector(point),
      x,
      y,
    };
  });
  const polylinePoints = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = `M0,90 ${polylinePoints} 100,90 Z`;
  const activeDate = hoveredDate ?? selectedDate;
  const activePoint =
    chartPoints.find((point) => point.date === activeDate) ?? null;
  const hoveredPoint =
    chartPoints.find((point) => point.date === hoveredDate) ?? null;
  const activeIndex =
    chartPoints.findIndex((point) => point.date === activeDate);
  const activePointXPercent =
    activeIndex <= 0 || chartPoints.length <= 1
      ? activePoint?.x ?? null
      : (activeIndex / (chartPoints.length - 1)) * 100;

  const updateHoveredPointFromClientX = (
    clientX: number,
    commitSelection = false
  ) => {
    const svg = svgRef.current;

    if (!svg || chartPoints.length === 0) {
      return;
    }

    const rect = svg.getBoundingClientRect();

    if (!rect.width) {
      return;
    }

    const relativeX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const normalizedX = relativeX / rect.width;
    const rawIndex = normalizedX * Math.max(chartPoints.length - 1, 0);
    const nextIndex = Math.round(rawIndex);
    const nextPoint = chartPoints[nextIndex];

    if (!nextPoint) {
      return;
    }

    setHoveredDate((current) =>
      current === nextPoint.date ? current : nextPoint.date
    );

    if (commitSelection) {
      onSelectPoint(nextPoint.date);
    }
  };

  return (
    <div
      className={cn(
        "relative rounded-3xl border border-border bg-background p-5 transition-colors duration-200 hover:border-primary/10",
        containerClassName
      )}
    >
      {hoveredPoint ? (
        <div
          className="pointer-events-none absolute z-10 rounded-xl border border-border/80 bg-background/95 px-3 py-2 text-start shadow-lg backdrop-blur"
          style={{
            left: `${hoveredPoint.x}%`,
            top: `${hoveredPoint.y}%`,
            transform: "translate(-50%, -115%)",
          }}
        >
          <p className="text-[11px] font-medium text-muted">
            {formatChartDate(hoveredPoint.date, locale)}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {formatTooltipValue(hoveredPoint)}
          </p>
        </div>
      ) : null}
      <svg
        aria-hidden="true"
        className={cn("h-60 w-full", colorClass, svgClassName)}
        fill="none"
        onClick={(event) => updateHoveredPointFromClientX(event.clientX, true)}
        onMouseMove={(event) => updateHoveredPointFromClientX(event.clientX)}
        onMouseLeave={() => setHoveredDate(null)}
        viewBox="0 0 100 90"
        preserveAspectRatio="none"
        ref={svgRef}
      >
        <path d="M0 90H100" stroke="currentColor" strokeOpacity="0.14" />
        <path d="M0 60H100" stroke="currentColor" strokeOpacity="0.08" />
        <path d="M0 30H100" stroke="currentColor" strokeOpacity="0.08" />
        {activePoint && activePointXPercent !== null ? (
          <path
            d={`M${activePointXPercent} 12V90`}
            stroke="currentColor"
            strokeDasharray="3 3"
            strokeOpacity="0.18"
          />
        ) : null}
        <path
          d={areaPath}
          fill="currentColor"
          fillOpacity={hoveredPoint ? "0.18" : "0.12"}
        />
        <polyline
          points={polylinePoints}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={hoveredPoint ? "2.8" : "2.5"}
        />
        {chartPoints.map((point) => {
          const isActive = activeDate === point.date;
          return (
            <g key={point.date}>
              <circle
                className="cursor-pointer"
                cx={point.x}
                cy={point.y}
                fill="transparent"
                r="5.5"
              />
              <circle
                cx={point.x}
                cy={point.y}
                fill="currentColor"
                fillOpacity={isActive ? 1 : 0.32}
                r={isActive ? 2.9 : 1.8}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function getRangeLabel(range: DashboardTimeRange, dictionary: Dictionary) {
  if (range === "7d") {
    return dictionary.dashboard.last7Days;
  }
  if (range === "30d") {
    return dictionary.dashboard.last30Days;
  }
  return dictionary.dashboard.allTime;
}

function formatChartDate(value: string, locale: string) {
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  const formatted = `${day}/${month}/${year}`;

  return locale === "ar" ? `\u200E${formatted}\u200E` : formatted;
}

function getNumberDisplayModeLabel(
  locale: string,
  mode: "compact" | "full"
) {
  if (locale === "ar") {
    return mode === "full" ? "كامل" : "مختصر";
  }

  return mode === "full" ? "Full" : "Compact";
}

function getActiveFilterSummary(
  locale: string,
  count: number,
  mode: "compact" | "full"
) {
  const formattedCount = formatCountValue(count, mode);

  if (locale === "ar") {
    return `${formattedCount} فلاتر نشطة`;
  }

  return `${formattedCount} active filters`;
}

function getLocalizedNumberDisplayModeLabel(
  locale: string,
  mode: "compact" | "full"
) {
  if (locale === "ar") {
    return mode === "full"
      ? "\u0643\u0627\u0645\u0644"
      : "\u0645\u062e\u062a\u0635\u0631";
  }

  return mode === "full" ? "Full" : "Compact";
}

function getLocalizedActiveFilterSummary(
  locale: string,
  count: number,
  mode: "compact" | "full"
) {
  const formattedCount = formatCountValue(count, mode);

  if (locale === "ar") {
    return `${formattedCount} \u0641\u0644\u0627\u062a\u0631 \u0646\u0634\u0637\u0629`;
  }

  return `${formattedCount} active filters`;
}

function getMetricLabel(
  metricId: DashboardMetric["id"],
  dictionary: Dictionary
) {
  const labels: Record<DashboardMetric["id"], string> = {
    total_revenue: dictionary.dashboard.totalRevenue,
    total_orders: dictionary.dashboard.totalOrders,
    average_order_value: dictionary.dashboard.averageOrderValue,
    refund_rate: dictionary.dashboard.refundRate,
    total_reviews: dictionary.dashboard.totalReviews,
    positive_share: dictionary.dashboard.positiveShare,
  };

  return labels[metricId];
}

function getMetricContextLabel(metric: DashboardMetric, dictionary: Dictionary) {
  if (!metric.context) {
    return dictionary.dashboard.datasetBaseline;
  }

  if (metric.context.kind === "new_reviews") {
    return `${metric.context.value} ${dictionary.dashboard.newReviewsHelper}`;
  }
  if (metric.context.kind === "positive_reviews") {
    return `${metric.context.value} ${dictionary.dashboard.positiveReviewsHelper}`;
  }
  if (metric.context.kind === "order_count") {
    return `${metric.context.value} ${dictionary.dashboard.ordersLabel}`;
  }
  if (metric.context.kind === "refund_value") {
    return `${formatCurrency(metric.context.value)} ${dictionary.dashboard.refundValueHelper}`;
  }
  if (metric.context.kind === "best_channel") {
    return `${dictionary.dashboard.salesChannels[metric.context.label]} ${dictionary.dashboard.leadingChannelHelper} ${formatCurrencyCompact(metric.context.value)}`;
  }
  return dictionary.dashboard.datasetBaseline;
}

function getBucketLabel(
  bucket: DashboardDistributionBucket,
  dictionary: Dictionary,
  variant: "rating" | "source" | "language" | "sentiment"
) {
  if (variant === "rating") {
    return `${bucket.label} / 5`;
  }
  if (variant === "language") {
    return dictionary.languageNames[bucket.id as keyof Dictionary["languageNames"]];
  }
  if (variant === "sentiment") {
    return dictionary.sentimentLabels[
      bucket.id as keyof Dictionary["sentimentLabels"]
    ];
  }
  return bucket.label;
}

function getPriorityLabel(
  priority: DashboardPriorityReview["priority"],
  dictionary: Dictionary
) {
  if (priority === "high") {
    return dictionary.dashboard.priorityHigh;
  }
  if (priority === "medium") {
    return dictionary.dashboard.priorityMedium;
  }
  return dictionary.dashboard.priorityLow;
}

function getPriorityReasonLabel(
  reason: DashboardPriorityReview["reason"],
  dictionary: Dictionary
) {
  const labels: Record<DashboardPriorityReview["reason"], string> = {
    negative_low_rating: dictionary.dashboard.reasonNegativeLowRating,
    unreviewed_negative: dictionary.dashboard.reasonUnreviewedNegative,
    new_unreviewed: dictionary.dashboard.reasonNewUnreviewed,
    follow_up_needed: dictionary.dashboard.reasonFollowUpNeeded,
  };

  return labels[reason];
}

function getActivityTypeLabel(
  type: DashboardActivityItem["type"],
  dictionary: Dictionary
) {
  const labels: Record<DashboardActivityItem["type"], string> = {
    new_review: dictionary.dashboard.activityNewReview,
    negative_alert: dictionary.dashboard.activityNegativeAlert,
    review_resolved: dictionary.dashboard.activityReviewResolved,
    positive_signal: dictionary.dashboard.activityPositiveSignal,
  };

  return labels[type];
}

function aggregateProductCategories(products: DashboardSalesProduct[]) {
  const totals = new Map<
    SalesProductCategory,
    { revenue: number; units: number }
  >();

  products.forEach((product) => {
    const current = totals.get(product.category);
    if (current) {
      current.revenue += product.revenue;
      current.units += product.units;
    } else {
      totals.set(product.category, {
        revenue: product.revenue,
        units: product.units,
      });
    }
  });

  const totalRevenue = Array.from(totals.values()).reduce(
    (sum, item) => sum + item.revenue,
    0
  );

  return Array.from(totals.entries()).map(([id, value]) => ({
    id,
    revenue: value.revenue,
    units: value.units,
    share: totalRevenue ? value.revenue / totalRevenue : 0,
  }));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 1000 ? 1 : 0,
  }).format(value);
}

function formatCountValue(
  value: number,
  mode: "compact" | "full"
) {
  return mode === "compact" ? formatCompactNumber(value) : formatNumber(value);
}

function formatCurrencyValue(
  value: number,
  mode: "compact" | "full"
) {
  return mode === "compact"
    ? formatCurrencyCompact(value)
    : formatCurrency(value);
}

function formatMetricValue(
  metric: DashboardMetric,
  mode: "compact" | "full"
) {
  if (metric.id === "total_revenue" || metric.id === "average_order_value") {
    return formatCurrencyValue(metric.value, mode);
  }

  if (metric.id === "total_orders" || metric.id === "total_reviews") {
    return formatCountValue(metric.value, mode);
  }

  return metric.displayValue;
}

function formatMetricTrend(
  metric: DashboardMetric,
  mode: "compact" | "full"
) {
  if (!metric.trend) {
    return "";
  }

  const sign = metric.trend.delta > 0 ? "+" : metric.trend.delta < 0 ? "-" : "";
  const absoluteValue = Math.abs(metric.trend.delta);

  if (metric.id === "total_revenue" || metric.id === "average_order_value") {
    return `${sign}${formatCurrencyValue(absoluteValue, mode)}`;
  }

  if (metric.id === "total_orders" || metric.id === "total_reviews") {
    return `${sign}${formatCountValue(absoluteValue, mode)}`;
  }

  return metric.trend.displayValue;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}
