type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
};

export function Textarea({ label, id, ...props }: TextareaProps) {
  const textareaId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="block space-y-2" htmlFor={textareaId}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <textarea
        className="min-h-32 w-full min-w-0 resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted focus:border-primary"
        id={textareaId}
        {...props}
      />
    </label>
  );
}
