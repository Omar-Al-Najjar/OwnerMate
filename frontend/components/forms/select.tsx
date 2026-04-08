import { cn } from "@/lib/utils/cn";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: Array<{ label: string; value: string }>;
};

export function Select({ label, id, options, className, ...props }: SelectProps) {
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="block space-y-2" htmlFor={selectId}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        className={cn(
          "w-full cursor-pointer rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-all duration-200 hover:border-primary/35 hover:bg-surface/60 focus:border-primary focus:ring-2 focus:ring-primary/10 focus-visible:outline-none",
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
