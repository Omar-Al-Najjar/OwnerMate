import { LoadingSkeleton } from "@/components/feedback/loading-skeleton";

export default function AppLoading() {
  return (
    <section className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="border-b border-border bg-card px-5 py-5 text-start shadow-panel sm:px-6">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-28 rounded-full bg-surface-highest" />
          <div className="h-9 w-full max-w-sm rounded-lg bg-surface-highest" />
          <div className="h-4 w-full max-w-2xl rounded-full bg-surface-highest" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <LoadingSkeleton />
        <LoadingSkeleton />
        <LoadingSkeleton />
      </div>

      <LoadingSkeleton />
    </section>
  );
}
