import type { SentimentLabel } from "@/types/review";

const sentimentClassMap: Record<SentimentLabel, string> = {
  positive: "bg-success/12 text-success ring-success/20",
  neutral: "bg-slate-900/8 text-slate-700 ring-slate-400/25 dark:bg-slate-100/10 dark:text-slate-200 dark:ring-slate-500/20",
  negative: "bg-error/12 text-error ring-error/20",
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
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ring-1 ring-inset ${sentimentClassMap[sentiment]}`}
    >
      {label ?? sentiment}
    </span>
  );
}
