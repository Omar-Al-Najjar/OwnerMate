import { cn } from "@/lib/utils/cn";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
};

export function Textarea({ label, id, className, ...props }: TextareaProps) {
  const textareaId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="block space-y-2" htmlFor={textareaId}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
        {label}
      </span>
      <textarea
        className={cn(
          "min-h-32 w-full min-w-0 resize-y rounded-2xl border border-border/70 bg-surface-lowest px-3.5 py-3 text-sm leading-6 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] outline-none transition placeholder:text-muted/90 hover:border-primary/35 focus:border-primary focus:ring-2 focus:ring-primary/10 focus-visible:outline-none",
          className
        )}
        id={textareaId}
        {...props}
      />
    </label>
  );
}
