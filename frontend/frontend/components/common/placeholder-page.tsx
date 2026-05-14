import { DataPanel } from "@/components/common/data-panel";
import { SectionHeader } from "@/components/common/section-header";

type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  items: string[];
};

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  items,
}: PlaceholderPageProps) {
  return (
    <section className="page-grid">
      <SectionHeader
        description={description}
        eyebrow={eyebrow}
        title={title}
      />
      <DataPanel title="Scaffold status">
        <ul className="space-y-3 text-sm text-muted">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-2xl border border-border/70 bg-surface-low/72 px-4 py-3.5"
            >
              {item}
            </li>
          ))}
        </ul>
      </DataPanel>
    </section>
  );
}
