export function LoadingSkeleton() {
  return (
    <div className="premium-card-quiet overflow-hidden p-5">
      <div className="animate-pulse space-y-4">
        <div className="h-3 w-28 rounded-full bg-surface-highest" />
        <div className="h-8 w-2/3 rounded-lg bg-surface-highest" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded-full bg-surface-highest" />
          <div className="h-4 w-5/6 rounded-full bg-surface-highest" />
          <div className="h-4 w-2/3 rounded-full bg-surface-highest" />
        </div>
      </div>
    </div>
  );
}
