import { PremiumCard, PremiumEyebrow } from "@/components/common/premium-primitives";

type DataPanelProps = {
  title: string;
  children: React.ReactNode;
};

export function DataPanel({ title, children }: DataPanelProps) {
  return (
    <PremiumCard as="section" className="p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
        <PremiumEyebrow as="h2">{title}</PremiumEyebrow>
      </div>
      {children}
    </PremiumCard>
  );
}
