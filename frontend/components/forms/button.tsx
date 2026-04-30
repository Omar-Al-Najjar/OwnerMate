import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "secondary";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  variant?: ButtonVariant;
};

const baseClasses =
  "inline-flex min-h-[2.75rem] cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold tracking-[-0.015em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-container bg-gradient-to-br from-primary to-primary-container text-white shadow-float hover:-translate-y-px hover:brightness-110 active:translate-y-0 active:brightness-95 disabled:opacity-80 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:brightness-100",
  secondary:
    "border border-border/70 bg-none bg-transparent text-foreground shadow-none hover:bg-surface-low hover:text-foreground active:bg-surface-high disabled:border-border/50 disabled:bg-transparent disabled:text-muted disabled:opacity-100",
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
