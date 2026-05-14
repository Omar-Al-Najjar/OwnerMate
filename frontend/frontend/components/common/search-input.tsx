import { Input } from "@/components/forms/input";

export function SearchInput({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}) {
  return <Input label={label} placeholder={placeholder} type="search" />;
}
