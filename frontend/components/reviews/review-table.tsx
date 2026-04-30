import type { Route } from "next";
import Link from "next/link";
import { RatingStars } from "@/components/reviews/rating-stars";
import { SentimentBadge } from "@/components/reviews/sentiment-badge";
import type { Review } from "@/types/review";

type ReviewTableProps = {
  locale: string;
  reviews: Review[];
  detailLabel: string;
  labels: {
    sentiment: Record<Review["sentiment"]["label"], string>;
    language: Record<Review["language"], string>;
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
    }).format(date),
    time: new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
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
    <div className="panel overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full border-separate border-spacing-0 text-sm">
          <thead className="bg-surface-high/70 text-muted">
            <tr>
              <th className="px-6 py-4 text-start text-[11px] font-semibold uppercase tracking-[0.22em]">
                {columns.reviewer}
              </th>
              <th className="px-6 py-4 text-start text-[11px] font-semibold uppercase tracking-[0.22em]">
                {columns.sentiment}
              </th>
              <th className="px-6 py-4 text-start text-[11px] font-semibold uppercase tracking-[0.22em]">
                {columns.rating}
              </th>
              <th className="px-6 py-4 text-start text-[11px] font-semibold uppercase tracking-[0.22em]">
                {columns.date}
              </th>
              <th className="px-6 py-4 text-start text-[11px] font-semibold uppercase tracking-[0.22em]">
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
                  className="border-t border-border/60 transition hover:bg-surface-low/85"
                >
                  <td className="px-6 py-5 align-top">
                    <div className="flex items-start gap-4 text-start">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-high text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
                        {getInitials(review.reviewerName)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold tracking-[-0.015em] text-foreground">
                          {review.reviewerName}
                        </p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted">
                          {review.source} / {labels.language[review.language]}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 align-top">
                    <SentimentBadge
                      label={labels.sentiment[review.sentiment.label]}
                      sentiment={review.sentiment.label}
                    />
                  </td>
                  <td className="px-6 py-5 align-top">
                    <div className="space-y-2 text-start">
                      <RatingStars rating={review.rating} />
                      <p className="text-xs font-medium text-muted">
                        {review.rating}/5
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-5 align-top">
                    <div className="space-y-1 text-start text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                      <p>{timestamp.day}</p>
                      <p>{timestamp.time}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5 align-top">
                    <div className="max-w-xl text-start">
                      <p className="line-clamp-2 text-sm leading-6 text-foreground">
                        {review.reviewText}
                      </p>
                      <Link
                        className="mt-3 inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.22em] text-primary transition hover:text-primary-hover"
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
  );
}
