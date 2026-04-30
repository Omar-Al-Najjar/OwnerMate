type DataPanelProps = {
  title: string;
  children: React.ReactNode;
};

export function DataPanel({ title, children }: DataPanelProps) {
  return (
    <section className="panel p-6">
      <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}
