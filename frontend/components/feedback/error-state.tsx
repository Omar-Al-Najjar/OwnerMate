export function ErrorState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-error/20 bg-card p-5 shadow-panel dark:bg-card">
      <div className="flex items-start gap-4">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-error/15 bg-error/10 text-error">
          <ErrorIcon />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}

function ErrorIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 8v4m0 4h.01M10.62 4.89 3.8 17.14A1.75 1.75 0 0 0 5.33 19.75h13.34a1.75 1.75 0 0 0 1.53-2.61L13.38 4.89a1.57 1.57 0 0 0-2.76 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}
