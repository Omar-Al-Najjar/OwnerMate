type DataPanelProps = {
  title: string;
  children: React.ReactNode;
};

export function DataPanel({ title, children }: DataPanelProps) {
  return (
    <section className="panel p-6">
      <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
