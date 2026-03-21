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
            <li key={item} className="rounded-lg bg-surface px-4 py-3">
              {item}
            </li>
          ))}
        </ul>
      </DataPanel>
    </section>
  );
}
