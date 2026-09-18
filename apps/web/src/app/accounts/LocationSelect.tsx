import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "../ui";
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
 * A dropdown that holds a checklist, rather than either of the obvious
 * alternatives. A bare checkbox list took as much vertical space as every other
 * field in the row combined and left the form lopsided; a native
 * `<select multiple>` needs ctrl-click to add a second option and shows no sign
 * that it does, which on a field most deals use once would lose the second
 * plant in silence. This reads as one control the size of a text input, and
 * opens to as many sites as the company has.
 *
 * Deployment sites used to be typed by hand on every deal, which is why the
 * same plant is spelled three ways across the pipeline. The company now keeps
 * its sites (see the Company Profile) and this offers them.
 */
export function LocationSelect({
  accountId,
  value,
  onChange,
  label = "Deployment sites",
  error,
}: LocationSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const locations = useQuery({
    queryKey: ["accountLocations", accountId, false],
    queryFn: () => accountsApi.locations(accountId),
    // Only ask once a company is picked; the empty case is an explanation, not
    // a request for every site in the org.
    enabled: !!accountId,
    staleTime: 5 * 60_000,
  });

  const items = locations.data ?? [];

  // Click-away and Escape both close it. Without the first, the panel stays
  // open behind whatever you clicked next and covers it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // A company with three plants does not need a search box; one with forty
  // does. The threshold is where scrolling starts to cost more than typing.
  const searchable = items.length > 8;
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((l) =>
      `${l.name} ${l.city ?? ""}`.toLowerCase().includes(needle),
    );
  }, [items, query]);

  const chosen = useMemo(
    () => value.map((id) => items.find((l) => l.id === id)).filter(Boolean),
    [value, items],
  );

  const toggle = (id: string) =>
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );

  const summary = () => {
    if (!accountId) return "Select a company first";
    if (value.length === 0) return "Choose sites…";
    if (chosen.length === 1) return chosen[0]!.name;
    // Names get long ("Khalapur Plant (forklift manufacturing)"), so past one
    // the trigger counts rather than truncating a list nobody can read.
    return `${value.length} sites selected`;
  };

  return (
    <div className="flex flex-col gap-xs" ref={boxRef}>
      <span className="text-xs font-medium text-fg-muted">{label}</span>

      <div className="relative">
        <button
          type="button"
          disabled={!accountId}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`flex h-[38px] w-full items-center justify-between gap-sm rounded-md border bg-surface px-sm text-left text-sm transition-colors disabled:cursor-not-allowed disabled:bg-surface-muted/60 disabled:text-fg-subtle ${
            error
              ? "border-bad"
              : open
                ? "border-accent"
                : "border-line hover:border-accent"
          }`}
        >
          <span
            className={`truncate ${value.length ? "text-fg" : "text-fg-subtle"}`}
          >
            {summary()}
          </span>
          <Icon
            name="chevronLeft"
            size={14}
            className={`shrink-0 text-fg-subtle transition-transform ${
              open ? "rotate-90" : "-rotate-90"
            }`}
          />
        </button>

        {open && accountId && (
          <div
            role="listbox"
            aria-multiselectable
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-[240px] overflow-y-auto overscroll-contain rounded-md border border-line bg-surface p-xs shadow-lg"
          >
            {searchable && (
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter sites…"
                className="mb-xs h-[30px] w-full rounded-sm border border-line bg-surface px-sm text-xs text-fg outline-none focus:border-accent"
              />
            )}

            {locations.isPending && (
              <p className="px-xs py-sm text-sm text-fg-subtle">Loading…</p>
            )}

            {!locations.isPending && items.length === 0 && (
              <p className="px-xs py-sm text-xs italic text-fg-subtle">
                No sites saved for this company. Add them on its Company
                Profile, or type one below.
              </p>
            )}

            {!locations.isPending && items.length > 0 && shown.length === 0 && (
              <p className="px-xs py-sm text-xs italic text-fg-subtle">
                Nothing matches that.
              </p>
            )}

            {shown.map((loc) => (
              <label
                key={loc.id}
                className="flex cursor-pointer items-center gap-sm rounded-sm px-xs py-1.5 text-sm text-fg transition-colors hover:bg-surface-hover"
              >
                <input
                  type="checkbox"
                  checked={value.includes(loc.id)}
                  onChange={() => toggle(loc.id)}
                  className="shrink-0 accent-accent"
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
        )}
      </div>

      {/* The chips are what make a collapsed multi-select readable: the trigger
          says "3 sites selected" and these say which three, removable without
          reopening the panel. */}
      {chosen.length > 1 && (
        <div className="flex flex-wrap gap-xs">
          {chosen.map((loc) => (
            <span
              key={loc!.id}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-surface-muted/70 pl-2 pr-1 py-0.5 text-[11px] text-fg-muted"
            >
              <span className="truncate">{loc!.name}</span>
              <button
                type="button"
                aria-label={`Remove ${loc!.name}`}
                onClick={() => toggle(loc!.id)}
                className="shrink-0 rounded p-0.5 text-fg-subtle transition-colors hover:bg-bad-soft hover:text-bad-fg"
              >
                <Icon name="close" size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <span className="text-xs text-bad-fg">{error}</span>}
    </div>
  );
}
