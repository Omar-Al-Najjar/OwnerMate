import type { Route } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/utils/formatters";
import { RatingStars } from "@/components/reviews/rating-stars";
import { SentimentBadge } from "@/components/reviews/sentiment-badge";
import { StatusBadge } from "@/components/reviews/status-badge";
import type { Review } from "@/types/review";

type ReviewCardProps = {
  review: Review;
  locale: string;
  detailLabel: string;
  labels: {
    sentiment: Record<Review["sentiment"]["label"], string>;
    status: Record<Review["status"], string>;
    language: Record<Review["language"], string>;
  };
};

export function ReviewCard({
  review,
  locale,
  detailLabel,
  labels,
}: ReviewCardProps) {
  const summaryTags = review.sentiment.summaryTags.slice(0, 3);

  return (
    <article className="panel group overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2 text-start">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full bg-surface-high px-2.5 py-1 font-semibold uppercase tracking-[0.16em] text-foreground">
              {review.source}
            </span>
            <span>{labels.language[review.language]}</span>
            <span aria-hidden="true">•</span>
            <span>{formatDate(review.reviewCreatedAt, locale)}</span>
          </div>
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
            {review.reviewerName}
          </h3>
          <p className="text-sm leading-6 text-foreground">{review.reviewText}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:max-w-56 lg:justify-end">
          <SentimentBadge
            label={labels.sentiment[review.sentiment.label]}
            sentiment={review.sentiment.label}
          />
          <StatusBadge
            label={labels.status[review.status]}
            status={review.status}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-surface-low p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <div className="flex items-center gap-2">
            <RatingStars rating={review.rating} />
            <span>{review.rating}/5</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {summaryTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted ring-1 ring-inset ring-border/70"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <Link
          className="inline-flex items-center justify-center rounded-lg border border-border/70 px-3.5 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-high hover:text-primary"
          href={`/${locale}/reviews/${review.id}` as Route}
        >
          {detailLabel}
        </Link>
      </div>
    </article>
  );
}
