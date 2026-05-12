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
    <header className="border-b border-border bg-card px-5 py-5 text-start shadow-panel sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="premium-eyebrow">{eyebrow}</p>
          <h1 className="premium-page-title mt-1.5">{title}</h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-6 text-muted">
            {description}
          </p>
        </div>
      </div>
    </header>
  );
}
