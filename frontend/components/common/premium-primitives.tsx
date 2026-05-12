import { cn } from "@/lib/utils/cn";

type PremiumCardTone = "default" | "quiet" | "inset" | "ink";

type PremiumCardProps = React.HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "section" | "article" | "aside";
  tone?: PremiumCardTone;
};

const cardToneClasses: Record<PremiumCardTone, string> = {
  default: "premium-card",
  quiet: "premium-card-quiet",
  inset: "premium-card-inset",
  ink: "rounded-xl border border-ink bg-ink text-card shadow-panel",
};

export function PremiumCard({
  as: Component = "div",
  children,
  className,
  tone = "default",
  ...props
}: PremiumCardProps) {
  return (
    <Component className={cn(cardToneClasses[tone], className)} {...props}>
      {children}
    </Component>
  );
}

export function PremiumEyebrow({
  as: Component = "p",
  children,
  className,
}: {
  as?: "p" | "span" | "h2" | "h3";
  children: React.ReactNode;
  className?: string;
}) {
  return <Component className={cn("premium-eyebrow", className)}>{children}</Component>;
}

export function PremiumMetric({
  value,
  helper,
  className,
}: {
  value: string;
  helper?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="metric-value font-serif text-[2rem] leading-none text-foreground">
        {value}
      </p>
      {helper ? <p className="mt-2 text-xs leading-5 text-muted">{helper}</p> : null}
    </div>
  );
}
