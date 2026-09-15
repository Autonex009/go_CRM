import { ArrowUpDown } from "lucide-react";

/**
 * The sort orders every paged list offers. The server holds the matching
 * ORDER BY for each key — sorting has to happen there, because these lists are
 * paged and sorting one page would only shuffle the rows already on screen.
 */
export const SORT_OPTIONS = [
  { key: "", label: "Default order" },
  { key: "name", label: "Name: A → Z" },
  { key: "nameDesc", label: "Name: Z → A" },
  { key: "created", label: "Newest first" },
  { key: "createdAsc", label: "Oldest first" },
  { key: "updated", label: "Recently updated" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["key"];

interface SortSelectProps {
  value: SortKey;
  onChange: (next: SortKey) => void;
  /** Overrides the A→Z labels where "name" is not the right word. */
  nameLabel?: string;
}

export function SortSelect({ value, onChange, nameLabel = "Name" }: SortSelectProps) {
  return (
    <label className="relative inline-flex items-center">
      <ArrowUpDown className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-fg-subtle" />
      <span className="sr-only">Sort by</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="h-9 appearance-none rounded-lg border border-line bg-surface pl-8 pr-7 text-sm text-fg-muted transition-colors hover:border-accent/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>
            {o.key === "name"
              ? `${nameLabel}: A → Z`
              : o.key === "nameDesc"
                ? `${nameLabel}: Z → A`
                : o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
