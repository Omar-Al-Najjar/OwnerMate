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
    <article className="panel group overflow-hidden p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2 text-start">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full bg-surface px-2.5 py-1 font-medium text-foreground">
              {review.source}
            </span>
            <span>{labels.language[review.language]}</span>
            <span aria-hidden="true">•</span>
            <span>{formatDate(review.reviewCreatedAt, locale)}</span>
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {review.reviewerName}
          </h3>
          <p className="text-sm leading-6 text-foreground">
            {review.reviewText}
          </p>
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

      <div className="mt-5 flex flex-col gap-4 border-t border-border pt-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <div className="flex items-center gap-2">
            <RatingStars rating={review.rating} />
            <span>{review.rating}/5</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {summaryTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <Link
          className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-all duration-200 hover:border-primary/30 hover:bg-surface hover:text-primary group-hover:border-primary/25"
          href={`/${locale}/reviews/${review.id}` as Route}
        >
          {detailLabel}
        </Link>
      </div>
    </article>
  );
}
