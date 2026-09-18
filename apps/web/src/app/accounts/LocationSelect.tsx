import { useQuery } from "@tanstack/react-query";

import { accountsApi } from "./api";

interface LocationSelectProps {
  /** The company whose sites to offer. Empty until one is chosen. */
  accountId: string;
  /** The chosen sites' ids, in pick order. */
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  error?: string;
}

/**
 * Site picker for a company — the counterpart to {@link AccountSelect}, for the
 * several sites one deal can be delivered to.
 *
 * A checkbox list rather than a `<select multiple>`: the native control needs
 * ctrl-click to add a second option and shows no affordance saying so, which on
 * a field most deals use once would lose the second plant silently.
 *
 * Deployment sites used to be typed by hand on every deal, which is why the
 * same plant is spelled three ways across the pipeline. The company now keeps
 * its sites (see the Company Profile) and this offers them.
 *
 * Two deliberate behaviours:
 *
 * It explains itself instead of rendering an empty list before a company is
 * chosen — an empty picker reads as broken data, not a missing prerequisite.
 *
 * It keeps a free-text escape hatch. A rep on a call who has reached a site
 * nobody has recorded must not be blocked; without it that detail goes in the
 * notes, where nothing can read it.
 */
export function LocationSelect({
  accountId,
  value,
  onChange,
  label = "Deployment sites",
  error,
}: LocationSelectProps) {
  const locations = useQuery({
    queryKey: ["accountLocations", accountId, false],
    queryFn: () => accountsApi.locations(accountId),
    // Only ask once a company is picked; the empty case is an explanation, not
    // a request for every site in the org.
    enabled: !!accountId,
    staleTime: 5 * 60_000,
  });

  const items = locations.data ?? [];

  const toggle = (id: string) =>
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );

  return (
    <div className="flex flex-col gap-xs">
      <span className="text-xs font-medium text-fg-muted">
        {label}
        {value.length > 0 && (
          <span className="ml-1 tabular-nums text-fg-subtle">
            · {value.length} selected
          </span>
        )}
      </span>

      <div className="max-h-[168px] overflow-y-auto overscroll-contain rounded-md border border-line bg-surface p-xs">
        {!accountId && (
          <p className="px-xs py-sm text-sm italic text-fg-subtle">
            Select a company first.
          </p>
        )}

        {accountId && locations.isPending && (
          <p className="px-xs py-sm text-sm text-fg-subtle">Loading…</p>
        )}

        {accountId && !locations.isPending && items.length === 0 && (
          <p className="px-xs py-sm text-sm italic text-fg-subtle">
            No sites saved for this company. Add them on its Company Profile, or
            type one below.
          </p>
        )}

        {items.map((loc) => (
          <label
            key={loc.id}
            className="flex cursor-pointer items-center gap-sm rounded px-xs py-1 text-sm text-fg transition-colors hover:bg-surface-hover"
          >
            <input
              type="checkbox"
              checked={value.includes(loc.id)}
              onChange={() => toggle(loc.id)}
              className="shrink-0"
            />
            <span className="min-w-0 flex-1 truncate">{loc.name}</span>
            {loc.city && (
              <span className="shrink-0 text-xs text-fg-subtle">
                {loc.city}
              </span>
            )}
          </label>
        ))}
      </div>

      {error && <span className="text-xs text-bad-fg">{error}</span>}
    </div>
  );
}
