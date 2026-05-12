import {
  PremiumCard,
  PremiumEyebrow,
  PremiumMetric,
} from "@/components/common/premium-primitives";

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
};

export function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <PremiumCard className="p-5 sm:p-6">
      <PremiumEyebrow>{label}</PremiumEyebrow>
      <PremiumMetric className="mt-4" helper={helper} value={value} />
    </PremiumCard>
  );
}
