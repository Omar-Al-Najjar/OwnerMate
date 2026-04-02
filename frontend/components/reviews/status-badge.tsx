import type { ReviewStatus } from "@/types/review";

const statusClassMap: Record<ReviewStatus, string> = {
  new: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  reviewed:
    "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
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
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClassMap[status]}`}
    >
      {label ?? status}
    </span>
  );
}
