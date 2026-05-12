import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  variant?: ButtonVariant;
};

const baseClasses =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-semibold transition-all duration-200 ease-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-primary bg-primary text-primary-foreground shadow-panel hover:bg-primary-hover active:bg-primary-hover disabled:opacity-70 disabled:shadow-none dark:text-card",
  secondary:
    "border border-border bg-card text-foreground shadow-panel hover:border-border/80 hover:bg-surface-low active:bg-surface-high disabled:border-border/50 disabled:bg-transparent disabled:text-muted disabled:opacity-100",
  ghost:
    "border border-transparent bg-transparent text-muted hover:bg-surface-low hover:text-foreground disabled:text-muted/60",
};

export function Button({
  children,
  className,
  isLoading = false,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(baseClasses, variantClasses[variant], className)}
      disabled={props.disabled || isLoading}
      {...props}
    >
      {children}
    </button>
  );
}
