import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Trash2, X } from "lucide-react";

import { ApiError } from "../lib/api";
import { implementationApi } from "./api";

/**
 * The ask's type, picked from the workspace's own list.
 *
 * A panel rather than a native select, because the list is editable: creating
 * and removing a type happen where you choose one, instead of being hidden in a
 * settings page nobody visits.
 */
export function TypeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ["askTypes"],
    queryFn: implementationApi.types,
    staleTime: 60_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["askTypes"] });
    void queryClient.invalidateQueries({ queryKey: ["implementation"] });
  };

  const create = useMutation({
    mutationFn: (name: string) => implementationApi.createType(name),
    onSuccess: (saved) => {
      setDraft("");
      setError(null);
      invalidate();
      // Choosing it straight away is the reason someone created it.
      onChange(saved.name);
      setOpen(false);
    },
    onError: (err: unknown) =>
      setError(
        err instanceof ApiError ? err.message : "Could not create that type",
      ),
  });

  const remove = useMutation({
    mutationFn: (id: string) => implementationApi.deleteType(id),
    onSuccess: invalidate,
    onError: () => setError("Could not delete that type"),
  });

  // Click-away and Escape close the panel, the way a select would.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const types = query.data ?? [];

  // An ask can carry a type that is no longer on the list — it was renamed, or
  // the entry was deleted while the label stayed on the ask. Showing it keeps
  // the current value visible and re-pickable instead of silently dropping it
  // the next time someone opens the dialog.
  const offList =
    value && !types.some((t) => t.name.toLowerCase() === value.toLowerCase());

  const submitDraft = () => {
    const name = draft.trim();
    if (!name) return;
    const existing = types.find(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      // Already on the list — pick it rather than refusing.
      onChange(existing.name);
      setDraft("");
      setOpen(false);
      return;
    }
    create.mutate(name);
  };

  return (
    <div className="flex flex-col gap-xs" ref={root}>
      <span className="text-xs font-medium text-fg-muted">Type</span>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex h-9 w-full items-center justify-between gap-sm rounded-md border border-line bg-surface px-sm text-left text-sm text-fg transition-colors hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
        >
          <span className={`truncate ${value ? "text-fg" : "text-fg-subtle"}`}>
            {value || "Choose a type"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-md border border-line bg-surface shadow-lg">
            <ul role="listbox" className="max-h-52 overflow-y-auto">
              {value && (
                <Option
                  label="No type"
                  muted
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                />
              )}

              {offList && (
                <li className="flex items-center gap-1 border-b border-line/60 pr-1">
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 px-sm py-2 text-sm">
                    <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <span className="truncate text-fg">{value}</span>
                    <span className="shrink-0 text-[10px] text-fg-subtle">
                      not in list
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => create.mutate(value)}
                    disabled={create.isPending}
                    title="Add this to the list"
                    className="shrink-0 rounded px-1.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent-soft disabled:opacity-60"
                  >
                    Add
                  </button>
                </li>
              )}

              {types.length === 0 && !offList && !query.isPending && (
                <li className="px-sm py-2 text-xs italic text-fg-subtle">
                  No types yet — add the first below
                </li>
              )}

              {types.map((t) => (
                <li key={t.id} className="group/type flex items-center gap-1 pr-1">
                  <button
                    type="button"
                    role="option"
                    aria-selected={t.name === value}
                    onClick={() => {
                      onChange(t.name);
                      setOpen(false);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-1.5 px-sm py-2 text-left text-sm text-fg transition-colors hover:bg-surface-hover"
                  >
                    {t.name === value ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    <span className="truncate">{t.name}</span>
                    {t.inUse > 0 && (
                      <span className="ml-auto shrink-0 text-[10px] tabular-nums text-fg-subtle">
                        {t.inUse}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    aria-label={`Delete type ${t.name}`}
                    title={
                      t.inUse > 0
                        ? `Used by ${t.inUse} ask${t.inUse === 1 ? "" : "s"} — they keep this label`
                        : "Delete this type"
                    }
                    onClick={() => {
                      const warning =
                        t.inUse > 0
                          ? `"${t.name}" is used by ${t.inUse} ask${t.inUse === 1 ? "" : "s"}. They keep the label, but it leaves the list. Delete it?`
                          : `Delete the type "${t.name}"?`;
                      if (window.confirm(warning)) remove.mutate(t.id);
                    }}
                    className="shrink-0 rounded p-1 text-fg-subtle opacity-0 transition-colors hover:text-bad-fg focus-visible:opacity-100 group-hover/type:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-1 border-t border-line p-1">
              <Plus className="ml-1 h-3.5 w-3.5 shrink-0 text-fg-subtle" />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitDraft();
                  }
                }}
                placeholder="Create new type…"
                className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm text-fg outline-none placeholder:text-fg-subtle"
              />
              {draft.trim() && (
                <button
                  type="button"
                  onClick={submitDraft}
                  disabled={create.isPending}
                  className="shrink-0 rounded bg-accent px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
                >
                  Add
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-1 text-xs text-bad-fg">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            <X className="h-3 w-3" />
          </button>
        </p>
      )}
    </div>
  );
}

function Option({
  label,
  muted = false,
  onSelect,
}: {
  label: string;
  muted?: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full px-sm py-2 pl-[30px] text-left text-sm transition-colors hover:bg-surface-hover ${
          muted ? "text-fg-subtle" : "text-fg"
        }`}
      >
        {label}
      </button>
    </li>
  );
}
