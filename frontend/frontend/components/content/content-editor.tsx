import { Textarea } from "@/components/forms/textarea";

type ContentEditorProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
};

export function ContentEditor({
  label,
  placeholder,
  value,
  onChange,
}: ContentEditorProps) {
  return (
    <Textarea
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
