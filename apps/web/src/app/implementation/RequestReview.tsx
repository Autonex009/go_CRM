import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, Link2, Undo2 } from "lucide-react";

import { relativeTime } from "../activities/api";
import { dealsApi, type Deal } from "../deals/api";
import { STAGE_META } from "../deals/stages";
import { Alert, Button, SelectField, TextareaField } from "../ui";
import { AskDialog } from "./AskDialog";
import { implementationApi, type Ask, type AskInput } from "./api";

/** Opens a manager request for GTM: edit it, then approve with a deal or send back. */
export function ReviewDialog({
  ask,
  onClose,
  onChanged,
}: {
  ask: Ask;
  onClose: () => void;
  /** Called with the updated ask when its deal changes. */
  onChanged?: (ask: Ask) => void;
}) {
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
          : ask.reviewStatus === "approved"
            ? <LinkDealPanel
                ask={ask}
                onDone={(a) => {
                  refresh();
                  onChanged?.(a);
                }}
              />
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
  const [dealId, setDealId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

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

      <DealPicker accountId={ask.accountId} accountName={ask.accountName} value={dealId} onChange={setDealId} />

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

/** Approved requests: GTM can move the ask to another active deal. */
function LinkDealPanel({ ask, onDone }: { ask: Ask; onDone: (a: Ask) => void }) {
  const [editing, setEditing] = useState(false);
  const [dealId, setDealId] = useState("");
  const [linked, setLinked] = useState(ask.dealTitle);
  const link = useMutation({
    mutationFn: () => implementationApi.linkDeal(ask.id, dealId),
    onSuccess: (a) => {
      setLinked(a.dealTitle);
      setEditing(false);
      setDealId("");
      onDone(a);
    },
  });

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-muted/40 p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 text-fg">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
          <span className="truncate">
            Linked deal: <strong className="font-semibold">{linked || "none"}</strong>
          </span>
        </span>
        {!editing && (
          <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Change deal
          </Button>
        )}
      </div>
      {editing && (
        <>
          <DealPicker accountId={ask.accountId} accountName={ask.accountName} value={dealId} onChange={setDealId} />
          {link.error && <Alert>{link.error instanceof Error ? link.error.message : "Could not link that deal"}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={!dealId || link.isPending} onClick={() => link.mutate()}>
              Link deal
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Active deals (not lost), the ask's company first; others behind a toggle. */
function DealPicker({
  accountId,
  accountName,
  value,
  onChange,
}: {
  accountId: string | null;
  accountName: string | null;
  value: string;
  onChange: (id: string) => void;
}) {
  const deals = useQuery({ queryKey: ["deals"], queryFn: dealsApi.board, staleTime: 60_000 });
  const [showAll, setShowAll] = useState(!accountId);

  const chosen = (deals.data?.deals ?? []).find((d) => d.id === value);
  const movesCompany = !!accountId && !!chosen?.accountId && chosen.accountId !== accountId;

  const options = useMemo(() => {
    const active = (deals.data?.deals ?? []).filter((d) => (d.stage as string) !== "lost");
    const list = showAll || !accountId ? active : active.filter((d) => d.accountId === accountId);
    return [...list].sort((a, b) => dealLabel(a).localeCompare(dealLabel(b)));
  }, [deals.data, showAll, accountId]);

  return (
    <>
      <SelectField
        label="Link to active deal"
        name="dealId"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
      {accountId && (
        <label className="flex items-center gap-1.5 text-[11px] text-fg-muted">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => {
              setShowAll(e.target.checked);
              onChange("");
            }}
          />
          Show deals from every company
        </label>
      )}
      {movesCompany && (
        <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
          This deal belongs to {chosen?.accountName ?? "another company"} — the ask and its sub-tasks will move to that
          company&apos;s pipeline.
        </p>
      )}
      {!deals.isPending && options.length === 0 && (
        <p className="text-[11px] text-fg-muted">
          No active deals for {accountName ?? "this company"} — tick the box above or create the deal first.
        </p>
      )}
    </>
  );
}

function dealLabel(d: Deal): string {
  return [d.accountName, d.title].filter(Boolean).join(" — ") || "Untitled deal";
}
