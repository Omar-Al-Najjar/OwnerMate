export function GeneratedContentBox({
  content,
  title,
}: {
  content: string;
  title?: string;
}) {
  return (
    <div className="panel min-h-56 min-w-0 overflow-hidden p-5">
      {title ? (
        <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      ) : null}
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
        {content}
      </p>
    </div>
  );
}
