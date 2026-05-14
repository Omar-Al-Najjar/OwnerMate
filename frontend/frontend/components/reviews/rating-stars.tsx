export function RatingStars({ rating }: { rating: number }) {
  return (
    <div
      aria-label={`Rating: ${rating} out of 5`}
      className="flex gap-1.5 text-lg leading-none text-amber-500 dark:text-amber-400"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index}>{index < rating ? "★" : "☆"}</span>
      ))}
    </div>
  );
}
