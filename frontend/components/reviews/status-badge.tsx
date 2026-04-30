import type { ReviewStatus } from "@/types/review";

const statusClassMap: Record<ReviewStatus, string> = {
  new: "bg-primary/12 text-primary ring-primary/20",
  reviewed: "bg-success/12 text-success ring-success/20",
};

export function StatusBadge({
  status,
  label,
}: {
  status: ReviewStatus;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ring-1 ring-inset ${statusClassMap[status]}`}
    >
      {label ?? status}
    </span>
  );
}
