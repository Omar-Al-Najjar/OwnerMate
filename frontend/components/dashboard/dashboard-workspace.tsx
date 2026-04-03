"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { SectionHeader } from "@/components/common/section-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/forms/button";
import { Select } from "@/components/forms/select";
import { ReviewList } from "@/components/reviews/review-list";
import {
  DEFAULT_DASHBOARD_FILTERS,
  getDashboardView,
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
  DashboardTimeRange,
  DashboardView,
} from "@/types/dashboard";

type DashboardWorkspaceProps = {
  locale: string;
  dictionary: Dictionary;
  data: DashboardPayload | null;
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

const ACTIVITY_TONE_STYLES: Record<DashboardActivityItem["type"], string> = {
  new_review: "bg-primary",
  negative_alert: "bg-red-500",
  review_resolved: "bg-slate-400",
  positive_signal: "bg-emerald-500",
};

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
}: DashboardWorkspaceProps) {
  const pathname = usePathname();
  const [filters, setFilters] = useState<DashboardFilters>(
    DEFAULT_DASHBOARD_FILTERS
  );

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

    return getDashboardView(data.reviews, filters);
  }, [data, filters]);

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

  return (
    <div className="space-y-8">
      <SectionHeader
        description={dictionary.dashboard.description}
        eyebrow={dictionary.navigation.dashboard}
        title={dictionary.dashboard.title}
      />

      <section className="soft-panel relative overflow-hidden p-6 sm:p-8">
        <div className="absolute -top-8 end-8 h-32 w-32 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-0 start-10 h-24 w-24 rounded-full bg-emerald-400/15 blur-3xl" />
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
              <span className="inline-flex items-center rounded-full border border-border bg-background/80 px-3 py-1.5 text-muted">
                {view.reviewCount} {dictionary.dashboard.reviewsInScope}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <HeroSummaryCard
              helper={`${dictionary.dashboard.reviewsInScope}: ${view.reviewCount}`}
              label={dictionary.dashboard.filterSummary}
              value={`${activeFilterCount}`}
            />
            <HeroSummaryCard
              helper={dictionary.dashboard.vsPreviousWindow}
              label={dictionary.dashboard.focusWindow}
              value={rangeLabel}
            />
            <HeroSummaryCard
              helper={dictionary.dashboard.reviewVolume}
              label={dictionary.dashboard.sourceFilter}
              value={sourceLabel}
            />
            <HeroSummaryCard
              helper={languageLabel}
              label={dictionary.dashboard.sentimentFilter}
              value={sentimentLabel}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-panel">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3 text-start">
            <p className="text-sm font-semibold text-foreground">
              {dictionary.dashboard.filterSummary}
            </p>
            <p className="text-sm text-muted">
              {dictionary.dashboard.reviewsInScope}: {view.reviewCount}
            </p>
            <div className="flex flex-wrap gap-2">
              {data.filterOptions.timeRanges.map((range) => {
                const isActive = filters.range === range;

                return (
                  <button
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition",
                      isActive
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-surface"
                    )}
                    key={range}
                    onClick={() =>
                      setFilters((current) => ({ ...current, range }))
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
                setFilters((current) => ({
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
                setFilters((current) => ({
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
                setFilters((current) => ({
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
                className="w-full bg-surface text-foreground hover:bg-slate-200 dark:hover:bg-slate-700"
                onClick={() => setFilters(DEFAULT_DASHBOARD_FILTERS)}
                type="button"
              >
                {dictionary.dashboard.clearFilters}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {view.reviewCount === 0 ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <EmptyState
            description={dictionary.dashboard.noReviewsInViewDescription}
            title={dictionary.dashboard.noReviewsInViewTitle}
          />
          <QuickActionsPanel dictionary={dictionary} locale={locale} />
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <SectionLead
              description={dictionary.dashboard.executiveSummaryDescription}
              title={dictionary.dashboard.executiveSummary}
            />
            <div className="grid gap-4 xl:grid-cols-5">
              {view.metrics.map((metric) => (
                <MetricCard
                  dictionary={dictionary}
                  key={metric.id}
                  metric={metric}
                />
              ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <SentimentPanel
                buckets={view.distributions.sentiment}
                dictionary={dictionary}
              />
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-1">
                <DistributionPanel
                  buckets={view.distributions.ratings}
                  description={dictionary.dashboard.sentimentHelper}
                  dictionary={dictionary}
                  title={dictionary.dashboard.ratingMix}
                  variant="rating"
                />
                <DistributionPanel
                  buckets={view.distributions.sources}
                  description={dictionary.dashboard.sourcesHelper}
                  dictionary={dictionary}
                  title={dictionary.dashboard.sourceMix}
                  variant="source"
                />
                <DistributionPanel
                  buckets={view.distributions.languages}
                  description={dictionary.common.language}
                  dictionary={dictionary}
                  title={dictionary.dashboard.languageMix}
                  variant="language"
                />
              </div>
            </div>
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
                reviews={view.priorityReviews}
              />
              <ActivityFeedPanel
                dictionary={dictionary}
                items={view.activityFeed}
                locale={locale}
              />
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <section className="panel p-6">
              <div className="mb-5 space-y-1 text-start">
                <h3 className="text-lg font-semibold text-foreground">
                  {dictionary.dashboard.recentReviewsTitle}
                </h3>
                <p className="text-sm text-muted">
                  {dictionary.dashboard.recentReviewsDescription}
                </p>
              </div>
              <ReviewList
                detailLabel={dictionary.reviews.openReview}
                labels={reviewLabels}
                locale={locale}
                reviews={view.recentReviews}
              />
            </section>
            <QuickActionsPanel dictionary={dictionary} locale={locale} />
          </section>
        </>
      )}
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
    <div className="rounded-2xl border border-border/80 bg-background/85 p-4 text-start shadow-sm backdrop-blur">
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

function MetricCard({
  metric,
  dictionary,
}: {
  metric: DashboardMetric;
  dictionary: Dictionary;
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
        "rounded-2xl border p-5 shadow-panel transition hover:-translate-y-0.5",
        METRIC_TONE_STYLES[tone]
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2 text-start">
          <p className="text-sm font-medium text-muted">
            {getMetricLabel(metric.id, dictionary)}
          </p>
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {metric.displayValue}
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
            ? `${metric.trend.displayValue} ${dictionary.dashboard.vsPreviousWindow}`
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

function SentimentPanel({
  buckets,
  dictionary,
}: {
  buckets: DashboardDistributionBucket[];
  dictionary: Dictionary;
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

      <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-surface">
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
            className="rounded-2xl border border-border bg-background p-4 text-start"
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
  variant,
}: {
  title: string;
  description: string;
  buckets: DashboardDistributionBucket[];
  dictionary: Dictionary;
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
          <div className="space-y-2" key={bucket.id}>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium text-foreground">
                {getBucketLabel(bucket, dictionary, variant)}
              </span>
              <span className="text-muted">{bucket.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface">
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
              className="rounded-2xl border border-border bg-background p-4 text-start"
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
                  className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 font-medium text-foreground transition hover:border-primary/40 hover:bg-surface hover:text-primary"
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
              className="block rounded-2xl border border-border bg-background p-4 transition hover:border-primary/30 hover:bg-surface"
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

function QuickActionsPanel({
  locale,
  dictionary,
}: {
  locale: string;
  dictionary: Dictionary;
}) {
  return (
    <section className="panel p-6">
      <div className="space-y-1 text-start">
        <h3 className="text-lg font-semibold text-foreground">
          {dictionary.dashboard.quickActions}
        </h3>
        <p className="text-sm text-muted">
          {dictionary.dashboard.quickActionsDescription}
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <article className="rounded-2xl border border-border bg-background p-4 text-start">
          <p className="text-sm font-semibold text-foreground">
            {dictionary.dashboard.openReviewAction}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            {dictionary.common.viewReviews}
          </p>
          <Link
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-hover"
            href={`/${locale}/reviews?sentiment=negative` as Route}
          >
            {dictionary.dashboard.jumpToReviewsAction}
          </Link>
        </article>

        <article className="rounded-2xl border border-border bg-background p-4 text-start">
          <p className="text-sm font-semibold text-foreground">
            {dictionary.dashboard.openContentAction}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            {dictionary.common.generateContent}
          </p>
          <Link
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-primary/20 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-indigo-100 dark:border-transparent dark:bg-primary dark:text-white dark:hover:bg-primary-hover"
            href={`/${locale}/ai-content` as Route}
          >
            {dictionary.dashboard.jumpToContentAction}
          </Link>
        </article>
      </div>
    </section>
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

function getMetricLabel(
  metricId: DashboardMetric["id"],
  dictionary: Dictionary
) {
  const labels: Record<DashboardMetric["id"], string> = {
    total_reviews: dictionary.dashboard.totalReviews,
    average_rating: dictionary.dashboard.averageRating,
    positive_share: dictionary.dashboard.positiveShare,
    new_reviews: dictionary.dashboard.newReviews,
    active_sources: dictionary.dashboard.activeSources,
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
  if (metric.context.kind === "source_count") {
    return `${metric.context.value} ${dictionary.dashboard.sourcesHelper}`;
  }
  if (metric.context.kind === "positive_reviews") {
    return `${metric.context.value} ${dictionary.dashboard.positiveReviewsHelper}`;
  }
  return `${metric.context.value} ${dictionary.dashboard.reviewsInScope}`;
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
