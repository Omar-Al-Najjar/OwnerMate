import type { SentimentLabel } from "@/types/review";

const sentimentClassMap: Record<SentimentLabel, string> = {
  positive:
    "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  negative: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

export function SentimentBadge({
  sentiment,
  label,
}: {
  sentiment: SentimentLabel;
  label?: string;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${sentimentClassMap[sentiment]}`}
    >
      {label ?? sentiment}
    </span>
  );
}
