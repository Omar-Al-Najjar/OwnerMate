import { ErrorState } from "@/components/feedback/error-state";
import { RatingStars } from "@/components/reviews/rating-stars";
import { SectionHeader } from "@/components/common/section-header";
import { SentimentBadge } from "@/components/reviews/sentiment-badge";
import { StatusBadge } from "@/components/reviews/status-badge";
import { apiClient } from "@/lib/api/client";
import { formatDate } from "@/lib/utils/formatters";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { ReviewDetailParams } from "@/types/i18n";

export default async function ReviewDetailPage({ params }: ReviewDetailParams) {
  const { locale, reviewId } = await params;
  const safeLocale = resolveLocale(locale);
  const dictionary = getDictionary(safeLocale);
  const reviewResponse = await apiClient.getReviewById(reviewId);
  const review = reviewResponse.status === "success" ? reviewResponse.data : null;

  if (!review) {
    return (
      <ErrorState
        description={
          reviewResponse.status === "error"
            ? reviewResponse.error?.message ?? dictionary.reviewDetail.missingDescription
            : dictionary.reviewDetail.missingDescription
        }
        title={dictionary.reviewDetail.missingTitle}
      />
    );
  }

  return (
    <section className="space-y-8">
      <SectionHeader
        description={review.reviewText}
        eyebrow={`${dictionary.navigation.reviews} / ${reviewId}`}
        title={dictionary.reviews.detailTitle}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
        <div className="space-y-6">
          <section className="panel p-6">
            <div className="flex flex-wrap items-center gap-2 text-start">
              <SentimentBadge
                label={dictionary.sentimentLabels[review.sentiment.label]}
                sentiment={review.sentiment.label}
              />
              <StatusBadge
                label={dictionary.statusLabels[review.status]}
                status={review.status}
              />
            </div>
            <h2 className="mt-4 text-start text-lg font-semibold text-foreground">
              {dictionary.common.reviewText}
            </h2>
            <p className="mt-3 text-start text-sm leading-7 text-foreground">
              {review.reviewText}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {review.sentiment.summaryTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel p-6">
            <h2 className="mb-5 text-start text-lg font-semibold text-foreground">
              {dictionary.reviewDetail.metadata}
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-surface px-4 py-3 text-start">
                <dt className="text-xs uppercase tracking-[0.18em] text-muted">
                  {dictionary.common.reviewer}
                </dt>
                <dd className="mt-2 text-sm font-medium text-foreground">
                  {review.reviewerName}
                </dd>
              </div>
              <div className="rounded-xl bg-surface px-4 py-3 text-start">
                <dt className="text-xs uppercase tracking-[0.18em] text-muted">
                  {dictionary.common.source}
                </dt>
                <dd className="mt-2 text-sm font-medium text-foreground">
                  {review.source}
                </dd>
              </div>
              <div className="rounded-xl bg-surface px-4 py-3 text-start">
                <dt className="text-xs uppercase tracking-[0.18em] text-muted">
                  {dictionary.common.language}
                </dt>
                <dd className="mt-2 text-sm font-medium text-foreground">
                  {dictionary.languageNames[review.language]}
                </dd>
              </div>
              <div className="rounded-xl bg-surface px-4 py-3 text-start">
                <dt className="text-xs uppercase tracking-[0.18em] text-muted">
                  {dictionary.common.date}
                </dt>
                <dd className="mt-2 text-sm font-medium text-foreground">
                  {formatDate(review.reviewCreatedAt, safeLocale)}
                </dd>
              </div>
              <div className="rounded-xl bg-surface px-4 py-3 text-start sm:col-span-2">
                <dt className="text-xs uppercase tracking-[0.18em] text-muted">
                  {dictionary.common.rating}
                </dt>
                <dd className="mt-2 flex items-center gap-3 text-sm font-medium text-foreground">
                  <RatingStars rating={review.rating} />
                  <span>{review.rating}/5</span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel p-6">
            <h2 className="mb-4 text-start text-lg font-semibold text-foreground">
              {dictionary.reviewDetail.sentimentResult}
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 text-sm text-muted">
                <span>{dictionary.common.sentiment}</span>
                <span className="font-medium text-foreground">
                  {dictionary.sentimentLabels[review.sentiment.label]}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 text-sm text-muted">
                <span>{dictionary.common.confidence}</span>
                <span className="font-medium text-foreground">
                  {Math.round(review.sentiment.confidence * 100)}%
                </span>
              </div>
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="mb-4 text-start text-lg font-semibold text-foreground">
              {dictionary.reviewDetail.summaryTags}
            </h2>
            <div className="flex flex-wrap gap-2">
              {review.sentiment.summaryTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
