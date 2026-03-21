import type { Route } from "next";
import Link from "next/link";
import { DataPanel } from "@/components/common/data-panel";
import { SectionHeader } from "@/components/common/section-header";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/forms/button";
import { ReviewList } from "@/components/reviews/review-list";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getRecentReviews, getReviews } from "@/lib/mock/data";
import type { LocaleParams } from "@/types/i18n";

export default async function DashboardPage({ params }: LocaleParams) {
  const { locale } = await params;
  const safeLocale = resolveLocale(locale);
  const dictionary = getDictionary(safeLocale);
  const reviewItems = getReviews();
  const recentReviewItems = getRecentReviews();

  const positive = reviewItems.filter(
    (review) => review.sentiment.label === "positive"
  ).length;
  const neutral = reviewItems.filter(
    (review) => review.sentiment.label === "neutral"
  ).length;
  const negative = reviewItems.filter(
    (review) => review.sentiment.label === "negative"
  ).length;
  const totalReviews = reviewItems.length;
  const totalSentiment = totalReviews || 1;
  const newReviews = reviewItems.filter(
    (review) => review.status === "new"
  ).length;
  const sourceCount = new Set(reviewItems.map((review) => review.source)).size;
  const averageRating = totalReviews
    ? reviewItems.reduce((sum, review) => sum + review.rating, 0) / totalReviews
    : 0;

  const positivePercent = Math.round((positive / totalSentiment) * 100);
  const neutralPercent = Math.round((neutral / totalSentiment) * 100);
  const negativePercent = Math.round((negative / totalSentiment) * 100);

  const labels = {
    sentiment: dictionary.sentimentLabels,
    status: dictionary.statusLabels,
    language: dictionary.languageNames,
  };

  return (
    <section className="space-y-8">
      <SectionHeader
        description={dictionary.dashboard.description}
        eyebrow={dictionary.navigation.dashboard}
        title={dictionary.dashboard.title}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
          <StatCard
            helper={`${newReviews} ${dictionary.dashboard.newReviewsHelper}`}
            label={dictionary.dashboard.totalReviews}
            value={String(totalReviews)}
          />
          <StatCard
            helper={`${sourceCount} ${dictionary.dashboard.sourcesHelper}`}
            label={dictionary.dashboard.averageRating}
            value={averageRating.toFixed(1)}
          />
        </div>

        <div className="panel p-5">
          <div className="flex flex-col gap-1 text-start">
            <p className="text-sm text-muted">
              {dictionary.dashboard.sentimentSummary}
            </p>
            <p className="text-xs text-muted">
              {dictionary.dashboard.sentimentHelper}
            </p>
          </div>
          <div className="mt-4 h-4 overflow-hidden rounded-full bg-surface">
            <div className="flex h-full w-full">
              <div
                className="h-full bg-green-500 dark:bg-green-400"
                style={{ width: `${positivePercent}%` }}
              />
              <div
                className="h-full bg-slate-400 dark:bg-slate-500"
                style={{ width: `${neutralPercent}%` }}
              />
              <div
                className="h-full bg-red-500 dark:bg-red-400"
                style={{ width: `${negativePercent}%` }}
              />
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-surface px-3 py-3 text-start">
              <span className="inline-flex items-center gap-2 text-xs text-muted">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500 dark:bg-green-400" />
                {dictionary.dashboard.positive}
              </span>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {positivePercent}%
              </p>
              <p className="text-xs text-muted">{positive}</p>
            </div>
            <div className="rounded-xl bg-surface px-3 py-3 text-start">
              <span className="inline-flex items-center gap-2 text-xs text-muted">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                {dictionary.dashboard.neutral}
              </span>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {neutralPercent}%
              </p>
              <p className="text-xs text-muted">{neutral}</p>
            </div>
            <div className="rounded-xl bg-surface px-3 py-3 text-start">
              <span className="inline-flex items-center gap-2 text-xs text-muted">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 dark:bg-red-400" />
                {dictionary.dashboard.negative}
              </span>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {negativePercent}%
              </p>
              <p className="text-xs text-muted">{negative}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <DataPanel title={dictionary.dashboard.recentReviewsTitle}>
          {recentReviewItems.length > 0 ? (
            <ReviewList
              detailLabel={dictionary.reviews.openReview}
              labels={labels}
              locale={safeLocale}
              reviews={recentReviewItems}
            />
          ) : (
            <EmptyState
              description={dictionary.dashboard.emptyDescription}
              title={dictionary.dashboard.emptyTitle}
            />
          )}
        </DataPanel>

        <div className="space-y-6">
          <DataPanel title={dictionary.dashboard.quickActions}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Link href={`/${safeLocale}/reviews` as Route}>
                <Button className="w-full" type="button">
                  {dictionary.common.viewReviews}
                </Button>
              </Link>
              <Link href={`/${safeLocale}/ai-content` as Route}>
                <Button
                  className="w-full border border-primary/20 bg-indigo-50 text-primary hover:bg-indigo-100 dark:border-transparent dark:bg-primary dark:text-white dark:hover:bg-primary-hover"
                  type="button"
                >
                  {dictionary.common.generateContent}
                </Button>
              </Link>
            </div>
          </DataPanel>

          <DataPanel title={dictionary.dashboard.sentimentOverview}>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="grid text-sm">
                <div className="relative flex items-center justify-between gap-4 bg-green-100 px-4 py-4 ps-6 dark:bg-green-950/20">
                  <span className="absolute inset-y-0 start-0 w-1 bg-green-700 dark:bg-green-500" />
                  <div className="min-w-0 text-start">
                    <p className="font-semibold text-green-900 dark:text-green-300">
                      {dictionary.dashboard.positive}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {positivePercent}%
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-foreground">
                    {positive}
                  </span>
                </div>
                <div className="relative flex items-center justify-between gap-4 border-t border-border bg-slate-200 px-4 py-4 ps-6 dark:bg-slate-900/60">
                  <span className="absolute inset-y-0 start-0 w-1 bg-slate-600 dark:bg-slate-500" />
                  <div className="min-w-0 text-start">
                    <p className="font-semibold text-slate-900 dark:text-slate-200">
                      {dictionary.dashboard.neutral}
                    </p>
                    <p className="mt-1 text-xs text-muted">{neutralPercent}%</p>
                  </div>
                  <span className="text-lg font-semibold text-foreground">
                    {neutral}
                  </span>
                </div>
                <div className="relative flex items-center justify-between gap-4 border-t border-border bg-red-100 px-4 py-4 ps-6 dark:bg-red-950/20">
                  <span className="absolute inset-y-0 start-0 w-1 bg-red-700 dark:bg-red-500" />
                  <div className="min-w-0 text-start">
                    <p className="font-semibold text-red-900 dark:text-red-300">
                      {dictionary.dashboard.negative}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {negativePercent}%
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-foreground">
                    {negative}
                  </span>
                </div>
              </div>
            </div>
          </DataPanel>
        </div>
      </div>
    </section>
  );
}
