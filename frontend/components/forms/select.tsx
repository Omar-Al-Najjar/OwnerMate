import { cn } from "@/lib/utils/cn";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: Array<{ label: string; value: string }>;
};

export function Select({
  label,
  id,
  options,
  className,
  ...props
}: SelectProps) {
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="block space-y-2.5" htmlFor={selectId}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
        {label}
      </span>
      <span className="relative block">
        <select
          className={cn(
            "w-full cursor-pointer appearance-none rounded-2xl border border-border/70 bg-surface-lowest px-4 py-3.5 pr-11 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] outline-none transition hover:border-primary/35 focus:border-primary focus:ring-2 focus:ring-primary/10 focus-visible:outline-none dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
            className
          )}
          id={selectId}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-muted">
          <ChevronIcon />
        </span>
      </span>
    </label>
  );
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m7 10 5 5 5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
