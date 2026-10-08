import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronDown, Inbox, Undo2 } from "lucide-react";

import { relativeTime } from "../activities/api";
import { dealsApi, type Deal } from "../deals/api";
import { STAGE_META } from "../deals/stages";
import { Alert, Avatar, Button, SelectField, TextareaField } from "../ui";
import { AskDialog } from "./AskDialog";
import { implementationApi, type Ask, type AskInput } from "./api";
import { PRIORITY_META } from "./meta";

const requestsKey = ["askRequests", "pending"] as const;

/** Manager ask requests waiting for sales/admin review, shown on Deals. */
export function AskRequestsInbox() {
  const [searchParams, setSearchParams] = useSearchParams();
  const linked = searchParams.get("request");
  const [open, setOpen] = useState(true);
  const [reviewing, setReviewing] = useState<Ask | null>(null);

  const requests = useQuery({
    queryKey: requestsKey,
    queryFn: () => implementationApi.requests("pending"),
    refetchInterval: 60_000,
  });

  // /deals?request=<id> from a notification opens that request.
  useEffect(() => {
    if (!linked || !requests.data) return;
    const hit = requests.data.find((a) => a.id === linked);
    if (hit) setReviewing(hit);
    else implementationApi.get(linked).then(setReviewing, () => undefined);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("request");
        return next;
      },
      { replace: true },
    );
  }, [linked, requests.data, setSearchParams]);

  const items = requests.data ?? [];
  if (items.length === 0 && !reviewing) return null;

  return (
    <>
      {items.length > 0 && (
        <section
          aria-label="Ask requests awaiting review"
          className="rounded-xl border border-amber-500/30 bg-amber-500/5"
        >
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center gap-2 px-md py-sm text-left"
          >
            <Inbox className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold text-fg">Ask requests</span>
            <span className="rounded-full bg-amber-500/15 px-2 text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {items.length}
            </span>
            <span className="text-xs text-fg-muted">from managers, waiting for a deal</span>
            <ChevronDown
              className={`ml-auto h-4 w-4 text-fg-subtle transition-transform ${open ? "" : "-rotate-90"}`}
            />
          </button>
          {open && (
            <ul className="divide-y divide-line border-t border-amber-500/20">
              {items.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-md py-2">
                  <Avatar name={a.createdByName || "Manager"} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{a.title}</p>
                    <p className="truncate text-[11px] text-fg-muted">
                      {a.createdByName || "A manager"}
                      {a.accountName ? ` · ${a.accountName}` : " · no company yet"}
                      {a.submittedAt ? ` · ${relativeTime(a.submittedAt)}` : ""}
                    </p>
                  </div>
                  {PRIORITY_META[a.priority] && (
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_META[a.priority].chip}`}>
                      {PRIORITY_META[a.priority].label}
                    </span>
                  )}
                  <Button type="button" size="sm" variant="secondary" onClick={() => setReviewing(a)}>
                    Review
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {reviewing && (
        <ReviewDialog ask={reviewing} onClose={() => setReviewing(null)} />
      )}
    </>
  );
}

function ReviewDialog({ ask, onClose }: { ask: Ask; onClose: () => void }) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["askRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["dealAsks"] });
    void queryClient.invalidateQueries({ queryKey: ["implementation"] });
    void queryClient.invalidateQueries({ queryKey: ["implementationPipelines"] });
  };
  const save = useMutation({
    mutationFn: (input: AskInput) => implementationApi.update(ask.id, input),
    onSuccess: refresh,
  });

  return (
    <AskDialog
      key={ask.id}
      ask={ask}
      parent={{
        accountId: ask.accountId ?? undefined,
        company: ask.accountName ?? "",
        label: ask.accountName ?? "No company yet",
        locations: ask.locations ?? undefined,
      }}
      onClose={onClose}
      onSubmit={(input) => save.mutateAsync(input)}
      extra={
        ask.reviewStatus === "pending"
          ? ({ save: saveForm }) => (
              <ReviewPanel
                ask={ask}
                saveForm={saveForm}
                onDone={() => {
                  refresh();
                  onClose();
                }}
              />
            )
          : undefined
      }
    />
  );
}

function ReviewPanel({
  ask,
  saveForm,
  onDone,
}: {
  ask: Ask;
  saveForm: () => Promise<Ask>;
  onDone: () => void;
}) {
  const deals = useQuery({ queryKey: ["deals"], queryFn: dealsApi.board, staleTime: 60_000 });
  const [showAll, setShowAll] = useState(!ask.accountId);
  const [dealId, setDealId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => {
    const all = deals.data?.deals ?? [];
    const list = showAll || !ask.accountId ? all : all.filter((d) => d.accountId === ask.accountId);
    return [...list].sort((a, b) => dealLabel(a).localeCompare(dealLabel(b)));
  }, [deals.data, showAll, ask.accountId]);

  const review = useMutation({
    mutationFn: async (action: "approve" | "reject") => {
      if (action === "approve") await saveForm();
      return implementationApi.review(ask.id, action, action === "approve" ? dealId : undefined, note.trim());
    },
    onSuccess: onDone,
    onError: (err) => setError(err instanceof Error ? err.message : "Could not save the review"),
  });

  const approve = () => {
    setError(null);
    if (!dealId) {
      setError("Choose the deal this request belongs to.");
      return;
    }
    review.mutate("approve");
  };
  const reject = () => {
    setError(null);
    if (!note.trim()) {
      setError("Add a note so the manager knows what to change.");
      return;
    }
    review.mutate("reject");
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="text-xs font-semibold text-fg">
        Review request from {ask.createdByName || "a manager"}
        {ask.submittedAt ? ` · ${relativeTime(ask.submittedAt)}` : ""}
      </p>
      <p className="text-[11px] text-fg-muted">
        Edit the fields below if needed — approving saves them too.
      </p>

      <SelectField
        label="Link to deal"
        name="dealId"
        value={dealId}
        onChange={(e) => setDealId(e.target.value)}
        disabled={deals.isPending}
      >
        <option value="">{deals.isPending ? "Loading deals…" : "Select a deal…"}</option>
        {options.map((d) => (
          <option key={d.id} value={d.id} disabled={!d.accountId}>
            {dealLabel(d)} · {STAGE_META[d.stage]?.label ?? d.stage}
            {d.accountId ? "" : " (no company — set one on the deal first)"}
          </option>
        ))}
      </SelectField>
      {ask.accountId && (
        <label className="flex items-center gap-1.5 text-[11px] text-fg-muted">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => {
              setShowAll(e.target.checked);
              setDealId("");
            }}
          />
          Show deals from every company
        </label>
      )}
      {!deals.isPending && options.length === 0 && (
        <p className="text-[11px] text-fg-muted">
          No deals for {ask.accountName ?? "this company"} yet — tick the box above or create the deal first.
        </p>
      )}

      <TextareaField
        label="Note to the manager (required to send back)"
        name="reviewNote"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional when approving"
      />

      {error && <Alert>{error}</Alert>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={review.isPending} onClick={reject}>
          <Undo2 className="h-3.5 w-3.5" /> Send back
        </Button>
        <Button type="button" size="sm" disabled={review.isPending} onClick={approve}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Approve &amp; link
        </Button>
      </div>
    </div>
  );
}

function dealLabel(d: Deal): string {
  return [d.accountName, d.title].filter(Boolean).join(" — ") || "Untitled deal";
}
