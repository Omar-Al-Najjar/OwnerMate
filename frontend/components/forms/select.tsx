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
    <label className="block space-y-2" htmlFor={selectId}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
        {label}
      </span>
      <select
        className={cn(
          "w-full cursor-pointer rounded-2xl border border-border/70 bg-surface-lowest px-3.5 py-2.5 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] outline-none transition hover:border-primary/35 focus:border-primary focus:ring-2 focus:ring-primary/10 focus-visible:outline-none",
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
    </label>
  );
}
