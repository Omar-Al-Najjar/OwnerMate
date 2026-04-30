type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
};

export function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <div className="panel p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
        {label}
      </p>
      <p className="mt-3 font-display text-3xl font-bold tracking-[-0.05em] text-foreground">
        {value}
      </p>
      {helper ? <p className="mt-2 text-xs leading-5 text-muted">{helper}</p> : null}
    </div>
  );
}
