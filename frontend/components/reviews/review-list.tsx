import type { Review } from "@/types/review";
import { ReviewCard } from "@/components/reviews/review-card";

type ReviewListProps = {
  locale: string;
  reviews: Review[];
  detailLabel: string;
  labels: {
    sentiment: Record<Review["sentiment"]["label"], string>;
    status: Record<Review["status"], string>;
    language: Record<Review["language"], string>;
  };
};

export function ReviewList({
  reviews,
  locale,
  detailLabel,
  labels,
}: ReviewListProps) {
  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <ReviewCard
          key={review.id}
          detailLabel={detailLabel}
          labels={labels}
          locale={locale}
          review={review}
        />
      ))}
    </div>
  );
}
