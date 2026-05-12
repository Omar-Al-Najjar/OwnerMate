import type { Route } from "next";
import Link from "next/link";
import { RatingStars } from "@/components/reviews/rating-stars";
import { SentimentBadge } from "@/components/reviews/sentiment-badge";
import type { ReviewListItem } from "@/types/review";

const REVIEWS_DISPLAY_TIME_ZONE = "UTC";

type ReviewTableProps = {
  locale: string;
  reviews: ReviewListItem[];
  detailLabel: string;
  labels: {
    sentiment: Record<ReviewListItem["sentiment"]["label"], string>;
    language: Record<ReviewListItem["language"], string>;
  };
  columns: {
    reviewer: string;
    sentiment: string;
    rating: string;
    date: string;
    reviewText: string;
  };
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatTimestamp(value: string, locale: string) {
  const date = new Date(value);

  return {
    day: new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "2-digit",
      year: "numeric",
      timeZone: REVIEWS_DISPLAY_TIME_ZONE,
    }).format(date),
    time: new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: REVIEWS_DISPLAY_TIME_ZONE,
    }).format(date),
  };
}

export function ReviewTable({
  locale,
  reviews,
  detailLabel,
  labels,
  columns,
}: ReviewTableProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:hidden">
        {reviews.map((review) => {
          const timestamp = formatTimestamp(review.reviewCreatedAt, locale);

          return (
            <article
              className="premium-card p-4"
              key={review.id}
            >
              <div className="flex items-start gap-4 text-start">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-low text-[10px] font-semibold uppercase text-foreground">
                  {getInitials(review.reviewerName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold tracking-[-0.015em] text-foreground">
                        {review.reviewerName}
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted">
                        {review.source} / {labels.language[review.language]}
                      </p>
                    </div>
                    <SentimentBadge
                      label={labels.sentiment[review.sentiment.label]}
                      sentiment={review.sentiment.label}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        {columns.rating}
                      </p>
                      <div className="space-y-1">
                        <RatingStars rating={review.rating} />
                        <p className="text-xs font-medium text-muted">
                          {review.rating}/5
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        {columns.date}
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {timestamp.day}
                      </p>
                      <p className="text-xs text-muted">{timestamp.time}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-border bg-surface-low p-3">
                    <p className="premium-eyebrow">
                      {columns.reviewText}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {review.reviewText}
                    </p>
                  </div>

                  <Link
                    className="mt-4 inline-flex items-center rounded-md border border-primary/14 bg-primary/8 px-2.5 py-1.5 text-[11px] font-semibold uppercase text-primary transition hover:bg-primary/12 hover:text-primary-hover"
                    href={`/${locale}/reviews/${review.id}` as Route}
                  >
                    {detailLabel}
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="premium-card hidden overflow-hidden p-0 lg:block">
        <div className="overflow-x-auto">
          <table className="premium-table min-w-[920px]">
          <thead className="premium-table-head">
            <tr>
              <th className="premium-table-th">
                {columns.reviewer}
              </th>
              <th className="premium-table-th">
                {columns.sentiment}
              </th>
              <th className="premium-table-th">
                {columns.rating}
              </th>
              <th className="premium-table-th">
                {columns.date}
              </th>
              <th className="premium-table-th">
                {columns.reviewText}
              </th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review) => {
              const timestamp = formatTimestamp(review.reviewCreatedAt, locale);

              return (
                <tr
                  key={review.id}
                  className="premium-table-row"
                >
                  <td className="premium-table-cell">
                    <div className="flex items-start gap-4 text-start">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface-low text-[10px] font-semibold uppercase text-foreground">
                        {getInitials(review.reviewerName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-foreground">
                          {review.reviewerName}
                        </p>
                        <p className="mt-1 text-[10px] uppercase text-muted">
                          {review.source} / {labels.language[review.language]}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="premium-table-cell">
                    <SentimentBadge
                      label={labels.sentiment[review.sentiment.label]}
                      sentiment={review.sentiment.label}
                    />
                  </td>
                  <td className="premium-table-cell">
                    <div className="space-y-2 text-start">
                      <RatingStars rating={review.rating} />
                      <p className="text-xs font-medium text-muted">
                        {review.rating}/5
                      </p>
                    </div>
                  </td>
                  <td className="premium-table-cell">
                    <div className="space-y-1 text-start text-[11px] font-semibold uppercase text-muted">
                      <p>{timestamp.day}</p>
                      <p className="metric-value">{timestamp.time}</p>
                    </div>
                  </td>
                  <td className="premium-table-cell">
                    <div className="max-w-xl text-start">
                      <p className="line-clamp-2 text-sm leading-6 text-foreground">
                        {review.reviewText}
                      </p>
                      <Link
                        className="mt-3 inline-flex items-center text-[11px] font-semibold uppercase text-primary transition hover:text-primary-hover"
                        href={`/${locale}/reviews/${review.id}` as Route}
                      >
                        {detailLabel}
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
