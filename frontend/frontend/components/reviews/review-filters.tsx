import { Input } from "@/components/forms/input";
import { Select } from "@/components/forms/select";

type ReviewFiltersProps = {
  values: {
    query: string;
    sentiment: string;
    language: string;
    source: string;
    rating: string;
    date: string;
  };
  labels: {
    search: string;
    searchPlaceholder: string;
    sentiment: string;
    language: string;
    source: string;
    rating: string;
    date: string;
  };
  options: {
    sentiment: Array<{ label: string; value: string }>;
    language: Array<{ label: string; value: string }>;
    source: Array<{ label: string; value: string }>;
    rating: Array<{ label: string; value: string }>;
    date: Array<{ label: string; value: string }>;
  };
  onChange: (name: string, value: string) => void;
};

export function ReviewFilters({
  values,
  labels,
  options,
  onChange,
}: ReviewFiltersProps) {
  return (
    <div className="soft-panel grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-7">
      <div className="xl:col-span-2">
        <Input
          label={labels.search}
          placeholder={labels.searchPlaceholder}
          type="search"
          value={values.query}
          onChange={(event) => onChange("query", event.target.value)}
        />
      </div>
      <Select
        label={labels.sentiment}
        options={options.sentiment}
        value={values.sentiment}
        onChange={(event) => onChange("sentiment", event.target.value)}
      />
      <Select
        label={labels.language}
        options={options.language}
        value={values.language}
        onChange={(event) => onChange("language", event.target.value)}
      />
      <Select
        label={labels.source}
        options={options.source}
        value={values.source}
        onChange={(event) => onChange("source", event.target.value)}
      />
      <Select
        label={labels.rating}
        options={options.rating}
        value={values.rating}
        onChange={(event) => onChange("rating", event.target.value)}
      />
      <Select
        label={labels.date}
        options={options.date}
        value={values.date}
        onChange={(event) => onChange("date", event.target.value)}
      />
    </div>
  );
}
