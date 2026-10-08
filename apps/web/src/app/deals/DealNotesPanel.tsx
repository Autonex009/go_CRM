import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, CloudOff, History, Loader2 } from "lucide-react";

import { relativeTime } from "../activities/api";
import { ApiError } from "../lib/api";
import { Button } from "../ui";
import { dealsApi, type DealNotes } from "./api";

const SAVE_DELAY_MS = 800;
const RETRY_MS = 3000;
const MAX_LEN = 20000;

type Status = "idle" | "saving" | "saved" | "offline" | "conflict";

const draftKey = (id: string) => `deal_notes_draft_${id}`;

function readDraft(id: string): string | null {
  try {
    return window.localStorage.getItem(draftKey(id));
  } catch {
    return null;
  }
}

function writeDraft(id: string, text: string | null) {
  try {
    if (text === null) window.localStorage.removeItem(draftKey(id));
    else window.localStorage.setItem(draftKey(id), text);
  } catch {
    // Storage unavailable: the server copy is the only copy.
  }
}

/** Free-form notes on a deal, saved as you type. */
export function DealNotesPanel({ dealId }: { dealId: string }) {
  const queryClient = useQueryClient();
  const loaded = useQuery({
    queryKey: ["dealNotes", dealId],
    queryFn: () => dealsApi.notes(dealId),
    staleTime: 0,
  });

  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [conflict, setConflict] = useState<DealNotes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unsavedDraft, setUnsavedDraft] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Refs so the save loop always sees the latest values without re-subscribing.
  const base = useRef<string | null>(null);
  const latest = useRef("");
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const blocked = useRef(false);
  const showConflict = (c: DealNotes | null, on: boolean) => {
    blocked.current = on;
    setConflict(c);
  };

  // First load: take the server copy, and offer any draft left by a failed save.
  useEffect(() => {
    if (!loaded.data || text !== null) return;
    base.current = loaded.data.updatedAt;
    latest.current = loaded.data.notes;
    setText(loaded.data.notes);
    setSavedAt(loaded.data.updatedAt);
    const draft = readDraft(dealId);
    if (draft !== null && draft !== loaded.data.notes) setUnsavedDraft(draft);
    else writeDraft(dealId, null);
  }, [loaded.data, text, dealId]);

  const syncCard = useCallback(
    (n: DealNotes) => {
      queryClient.setQueryData(["dealNotes", dealId], n);
      void queryClient.invalidateQueries({ queryKey: ["dealNoteRevisions", dealId] });
    },
    [queryClient, dealId],
  );

  // One save at a time, in order: each runs after the previous settles, so
  // every request carries the base the last one returned.
  const saveOnce = useCallback(async (): Promise<void> => {
    if (!dirty.current || blocked.current) return;
    const sending = latest.current;
    setStatus("saving");
    try {
      const saved = await dealsApi.saveNotes(dealId, sending, base.current);
      base.current = saved.updatedAt;
      setSavedAt(saved.updatedAt);
      syncCard(saved);
      if (latest.current === sending) {
        dirty.current = false;
        writeDraft(dealId, null);
        setStatus("saved");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const current = await dealsApi.notes(dealId).catch(() => null);
        showConflict(current ?? { notes: "", updatedAt: null, updatedByName: null }, true);
        setStatus("conflict");
        return;
      }
      // Keep a local copy until the server has it; retry shortly.
      writeDraft(dealId, latest.current);
      setStatus("offline");
      setError(err instanceof Error ? err.message : "Could not save");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void save(), RETRY_MS);
    }
  }, [dealId, syncCard]);

  const chain = useRef<Promise<void>>(Promise.resolve());
  const save = useCallback((): Promise<void> => {
    chain.current = chain.current.then(saveOnce, saveOnce);
    return chain.current;
  }, [saveOnce]);

  const onChange = (value: string) => {
    setText(value);
    latest.current = value;
    dirty.current = true;
    setError(null);
    writeDraft(dealId, value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), SAVE_DELAY_MS);
  };

  // Warn before the tab closes with unsaved text.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // Closing the deal saves straight away instead of waiting for the debounce;
  // if that fails the text is still in this browser's draft.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (dirty.current && !blocked.current) void saveRef.current();
    },
    [],
  );

  const useTheirs = () => {
    if (!conflict) return;
    base.current = conflict.updatedAt;
    latest.current = conflict.notes;
    dirty.current = false;
    writeDraft(dealId, null);
    setText(conflict.notes);
    setSavedAt(conflict.updatedAt);
    syncCard(conflict);
    showConflict(null, false);
    setStatus("saved");
  };

  const keepMine = () => {
    if (!conflict) return;
    // Their version is kept as a revision on the server when mine replaces it.
    base.current = conflict.updatedAt;
    dirty.current = true;
    showConflict(null, false);
    setStatus("idle");
    void save();
  };

  const restoreDraft = () => {
    if (unsavedDraft === null) return;
    onChange(unsavedDraft);
    setUnsavedDraft(null);
  };

  return (
    <section aria-label="Notes" className="flex flex-col gap-2 rounded-lg border border-line bg-surface-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Notes</h3>
        <SaveState status={status} savedAt={savedAt} error={error} />
      </div>
      <div className="flex flex-col gap-3">
        {loaded.isError && (
          <p className="rounded-md bg-bad-soft px-3 py-2 text-xs text-bad-fg">
            {loaded.error instanceof Error ? loaded.error.message : "Could not load notes"}
          </p>
        )}

        {unsavedDraft !== null && (
          <div className="flex items-center gap-2 rounded-md bg-warn-soft px-3 py-2 text-xs text-warn-fg">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">An unsaved draft from this browser was found.</span>
            <Button type="button" size="sm" variant="secondary" onClick={restoreDraft}>
              Restore draft
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                writeDraft(dealId, null);
                setUnsavedDraft(null);
              }}
            >
              Discard
            </Button>
          </div>
        )}

        {conflict && (
          <div className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-fg">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              {conflict.updatedByName || "Someone else"} changed these notes
              {conflict.updatedAt ? ` ${relativeTime(conflict.updatedAt)}` : ""}.
            </p>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-surface px-2 py-1.5 font-sans text-fg-muted">
              {conflict.notes || "(empty)"}
            </pre>
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={useTheirs}>
                Use their version
              </Button>
              <Button type="button" size="sm" onClick={keepMine}>
                Keep mine
              </Button>
            </div>
            <p className="text-[11px] text-fg-subtle">Either way, the other version stays in history.</p>
          </div>
        )}

        <textarea
          value={text ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={text === null || !!conflict}
          maxLength={MAX_LEN}
          rows={5}
          aria-label="Deal notes"
          placeholder={text === null ? "Loading…" : "Write anything about this deal — it saves as you type."}
          className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed text-fg placeholder:text-fg-subtle focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
        />

        <div className="flex items-center justify-end gap-2 text-[11px] text-fg-subtle">
          <span className="tabular-nums">
            {(text ?? "").length.toLocaleString()} / {MAX_LEN.toLocaleString()}
          </span>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg"
          >
            <History className="h-3.5 w-3.5" /> {showHistory ? "Hide" : "Show"} earlier versions
          </button>
          {showHistory && (
            <Revisions dealId={dealId} onRestore={(content) => onChange(content)} disabled={!!conflict} />
          )}
        </div>

      </div>
    </section>
  );
}

function SaveState({ status, savedAt, error }: { status: Status; savedAt: string | null; error: string | null }) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (status === "offline") {
    return (
      <span className="inline-flex items-center gap-1 text-bad-fg" title={error ?? undefined}>
        <CloudOff className="h-3 w-3" /> Not saved yet — kept in this browser, retrying…
      </span>
    );
  }
  if (status === "conflict") return <span className="text-amber-600">Paused — resolve the conflict above</span>;
  if (savedAt) {
    return (
      <span className="inline-flex items-center gap-1">
        <Check className="h-3 w-3 text-ok-fg" /> Saved {relativeTime(savedAt)}
      </span>
    );
  }
  return <span>Autosaves as you type</span>;
}

function Revisions({
  dealId,
  onRestore,
  disabled,
}: {
  dealId: string;
  onRestore: (content: string) => void;
  disabled: boolean;
}) {
  const revisions = useQuery({
    queryKey: ["dealNoteRevisions", dealId],
    queryFn: () => dealsApi.noteRevisions(dealId),
  });
  if (revisions.isPending) return <p className="mt-2 text-xs text-fg-subtle">Loading…</p>;
  const items = revisions.data ?? [];
  if (items.length === 0) return <p className="mt-2 text-xs text-fg-subtle">No earlier versions yet.</p>;
  return (
    <ul className="mt-2 flex max-h-56 flex-col gap-2 overflow-y-auto">
      {items.map((r) => (
        <li key={r.id} className="rounded-md border border-line px-2.5 py-2 text-xs">
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-fg-subtle">
            <span>
              {r.editedByName || "Someone"}
              {r.editedAt ? ` · ${relativeTime(r.editedAt)}` : ""}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRestore(r.content)}
              className="font-medium text-accent hover:underline disabled:opacity-50"
            >
              Restore
            </button>
          </div>
          <p className="line-clamp-4 whitespace-pre-wrap break-words text-fg-muted">{r.content}</p>
        </li>
      ))}
    </ul>
  );
}
