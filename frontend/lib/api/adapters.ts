import type { Review } from "@/types/review";

type BackendReviewRead = {
  id: string;
  source_type: string;
  reviewer_name: string | null;
  rating: number | null;
  language: string | null;
  review_text: string;
  review_created_at: string | null;
  status: "pending" | "reviewed" | "responded";
};

type BackendSentimentResultRead = {
  label: "positive" | "neutral" | "negative";
  confidence: number | null;
  summary_tags: string[] | null;
};

function normalizeLanguage(value: string | null): Review["language"] {
  return value === "ar" ? "ar" : "en";
}

function normalizeStatus(value: BackendReviewRead["status"]): Review["status"] {
  return value === "pending" ? "new" : "reviewed";
}

function formatSourceLabel(value: string): string {
  if (!value.trim()) {
    return "Unknown";
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function toFrontendReview(
  review: BackendReviewRead,
  sentiment?: BackendSentimentResultRead | null
): Review {
  return {
    id: review.id,
    source: formatSourceLabel(review.source_type),
    rating: review.rating ?? 0,
    language: normalizeLanguage(review.language),
    reviewerName: review.reviewer_name ?? "Anonymous",
    reviewText: review.review_text,
    reviewCreatedAt: review.review_created_at ?? new Date().toISOString(),
    status: normalizeStatus(review.status),
    sentiment: {
      label: sentiment?.label ?? "neutral",
      confidence: sentiment?.confidence ?? 0,
      summaryTags: sentiment?.summary_tags ?? [],
    },
  };
}
