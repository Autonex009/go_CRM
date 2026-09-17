import { useQuery } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { actionsApi, dueLabel, type Action } from "../actions/api";
import { useActionMutations } from "../actions/useActionMutations";
import { memberLabel, orgApi } from "../org/api";
import { Alert, Button, Field } from "../ui";
import type { Deal } from "./api";

/**
 * This deal's actions, as a checklist beside its tasks.
 *
 * Deliberately the shape of the tasks panel next to it rather than the Actions
 * page in miniature: the two halves of this dialog answer the same question
 * about the same deal, and giving one of them KPI cards, scope tabs and a table
 * made them read as unrelated screens that happened to share a modal.
 *
 * It is the same data as the Actions page all the same — the same endpoints and
 * the same `["actions"]` cache key through {@link useActionMutations} — so
 * ticking something here marks it done everywhere, and an action added here is
 * on the dashboard before you close the dialog.
 */
export function DealActionsPanel({ deal }: { deal: Deal }) {
  const { save, remove, complete, error, setError } = useActionMutations();

  const filter = { dealId: deal.id };
  const query = useQuery({
    queryKey: ["actions", filter],
    queryFn: () => actionsApi.list(filter),
  });

  const members = useQuery({
    queryKey: ["members"],
    queryFn: orgApi.members,
    staleTime: 5 * 60_000,
  });
  const memberOptions = members.data ?? [];

  const [title, setTitle] = useState("");
  const [due, setDue] = useState(today());
  const [assignee, setAssignee] = useState("");

  // Open first, then by when they are due: the overdue line at the top is the
  // reason to open this panel at all.
  const items = [...(query.data ?? [])].sort(
    (a, b) =>
      Number(a.status === "done") - Number(b.status === "done") ||
      a.dueAt.localeCompare(b.dueAt),
  );
  const openCount = items.filter((a) => a.status !== "done").length;

  /** Every write sends the whole action, so each one starts from what is there. */
  const patch = (action: Action, change: Partial<Action>) =>
    save.mutate({
      id: action.id,
      input: {
        title: change.title ?? action.title,
        dueAt: change.dueAt ?? action.dueAt,
        status: change.status ?? action.status,
        assignedTo:
          (change.assignedTo !== undefined
            ? change.assignedTo
            : action.assignedTo) ?? undefined,
        accountId: action.accountId ?? undefined,
        leadId: action.leadId ?? undefined,
        dealId: action.dealId ?? undefined,
      },
    });

  // `complete` is its own endpoint because it records who closed it and when;
  // re-opening is an ordinary status change, so the two halves of the toggle
  // are not symmetrical.
  const toggleDone = (action: Action) =>
    action.status === "done"
      ? patch(action, { status: "open" })
      : complete.mutate(action.id);

  const add = () => {
    const text = title.trim();
    if (!text) return;
    save.mutate(
      {
        input: {
          title: text,
          dueAt: `${due}T09:00:00Z`,
          status: "open",
          assignedTo: assignee || undefined,
          dealId: deal.id,
          accountId: deal.accountId ?? undefined,
          leadId: deal.leadId ?? undefined,
        },
      },
      {
        onSuccess: () => {
          setTitle("");
          setAssignee("");
          setDue(today());
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-md p-lg pt-md lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
      {error && <Alert>{error}</Alert>}

      <div className="flex flex-col gap-xs">
        <span className="text-xs font-medium text-fg-muted">
          Actions
          {items.length > 0 &&
            ` — ${openCount} open, ${items.length - openCount} completed`}
        </span>

        {query.isPending && (
          <p className="py-sm text-sm text-fg-subtle">Loading…</p>
        )}

        {!query.isPending && items.length === 0 && (
          <p className="py-sm text-sm italic text-fg-subtle">
            No actions yet. Add the first one below.
          </p>
        )}

        <ul className="flex flex-col gap-xs">
          {items.map((action) => {
            const when = dueLabel(action);
            return (
              <li
                key={action.id}
                className="flex items-start gap-sm rounded-md border border-line bg-surface p-xs"
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={action.status === "done"}
                  onClick={() => toggleDone(action)}
                  aria-label={`Mark "${action.title}" ${
                    action.status === "done" ? "not done" : "done"
                  }`}
                  title={action.status === "done" ? "Re-open" : "Mark done"}
                  className={`mt-[5px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                    action.status === "done"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-line text-transparent hover:border-emerald-500 hover:text-emerald-500"
                  }`}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </button>

                <div className="min-w-0 flex-1">
                  <ActionTitle
                    action={action}
                    onSave={(next) => patch(action, { title: next })}
                  />
                  {/* The date is the action's whole point, so it is editable in
                      place rather than behind a dialog — and it says how late it
                      is, which a bare date does not. */}
                  <div className="flex flex-wrap items-center gap-x-sm gap-y-0">
                    <input
                      type="date"
                      value={action.dueAt.slice(0, 10)}
                      aria-label={`Due date for "${action.title}"`}
                      onChange={(e) =>
                        e.target.value &&
                        patch(action, { dueAt: `${e.target.value}T09:00:00Z` })
                      }
                      className="-ml-1 rounded border border-transparent bg-transparent px-1 text-[10px] text-fg-subtle hover:border-line focus:border-accent focus:outline-none"
                    />
                    {action.status !== "done" && (
                      <span
                        className={`text-[10px] ${
                          when.tone === "overdue"
                            ? "font-semibold text-rose-500"
                            : when.tone === "due"
                              ? "font-semibold text-amber-600"
                              : "text-fg-subtle"
                        }`}
                      >
                        {when.text}
                      </span>
                    )}
                  </div>
                </div>

                <select
                  value={action.assignedTo ?? ""}
                  onChange={(e) =>
                    patch(action, { assignedTo: e.target.value || null })
                  }
                  aria-label={`Assignee for "${action.title}"`}
                  className="mt-[1px] h-7 max-w-32 shrink-0 rounded border border-line bg-surface px-1 text-xs text-fg-muted focus:border-accent focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {memberOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {memberLabel(m)}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm("Delete this action?")) return;
                    remove.mutate(action.id);
                  }}
                  aria-label={`Remove "${action.title}"`}
                  className="mt-[5px] shrink-0 rounded p-1 text-fg-subtle transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-sm rounded-md border border-line bg-surface-muted/50 p-sm">
        <Field
          label="Add an action"
          placeholder="Send the revised quote…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-sm">
          <label className="flex items-center gap-xs text-xs text-fg-muted">
            Due
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-8 rounded border border-line bg-surface px-2 text-xs text-fg focus:border-accent focus:outline-none"
            />
          </label>
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            aria-label="Assign the new action"
            className="h-8 max-w-40 rounded border border-line bg-surface px-2 text-xs text-fg-muted focus:border-accent focus:outline-none"
          >
            <option value="">Unassigned</option>
            {memberOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {memberLabel(m)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={add}
            disabled={!title.trim() || !due || save.isPending}
            className="ml-auto"
          >
            {save.isPending ? "Adding…" : "Add action"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The editable action title — a textarea that grows, for the same reason the
 * task text is one: an action written as a sentence should not have its end cut
 * off by the width of a column. The hidden copy gives the row its height.
 */
function ActionTitle({
  action,
  onSave,
}: {
  action: Action;
  onSave: (title: string) => void;
}) {
  const [draft, setDraft] = useState(action.title);

  useEffect(() => {
    setDraft(action.title);
  }, [action.title]);

  const shared = `text-sm leading-snug ${
    action.status === "done" ? "text-fg-subtle line-through" : "text-fg"
  }`;

  return (
    <div className="grid">
      <span
        aria-hidden="true"
        className={`invisible col-start-1 row-start-1 w-0 min-w-full whitespace-pre-wrap break-words py-1 ${shared}`}
      >
        {draft + " "}
      </span>
      <textarea
        rows={1}
        value={draft}
        aria-label="Action"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const next = draft.trim();
          // An emptied title is a delete by accident, not a rename.
          if (!next) return setDraft(action.title);
          if (next !== action.title) onSave(next);
        }}
        className={`col-start-1 row-start-1 w-full resize-none overflow-hidden break-words bg-transparent py-1 focus:outline-none ${shared}`}
      />
    </div>
  );
}

/** Today as YYYY-MM-DD, in the viewer's own timezone. */
function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}
