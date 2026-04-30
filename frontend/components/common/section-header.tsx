type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
}: SectionHeaderProps) {
  return (
    <header className="space-y-4 text-start">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
        {eyebrow}
      </p>
      <div className="space-y-3">
        <h1 className="max-w-4xl font-display text-[2.35rem] font-bold tracking-[-0.055em] text-foreground sm:text-[3rem]">
          {title}
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-muted sm:text-base">
          {description}
        </p>
      </div>
    </header>
  );
}
