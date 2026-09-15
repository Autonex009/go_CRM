import { useState } from "react";
import { Check, Trash2 } from "lucide-react";

import { ApiError } from "../lib/api";
import { Alert, Badge, Button, Field, Modal } from "../ui";
import { toDealInput, type Deal, type DealInput } from "./api";
import {
  PRIORITY_META,
  TASK_PRIORITIES,
  parseChecklist,
  serializeChecklist,
  type ChecklistItem,
  type TaskPriority,
} from "./checklist";
import { getStageMeta, stageLabel } from "./stages";

interface ChecklistDialogProps {
  deal: Deal;
  onClose: () => void;
  onSubmit: (input: DealInput) => Promise<unknown>;
}

/**
 * Edits a deal's checklist — the replacement for the old free-text remark.
 * Items are stored back into the deal's remark column, so this dialog owns the
 * whole list and writes it in one update.
 *
 * Tasks are deliberately unassigned and untracked. Work that needs an owner and
 * a due date is an Action, created from the card's Actions toggle.
 */
export function ChecklistDialog({ deal, onClose, onSubmit }: ChecklistDialogProps) {
  const [items, setItems] = useState<ChecklistItem[]>(() =>
    parseChecklist(deal.remark ?? deal.description, [
      deal.leadName ?? "",
      deal.contactName ?? "",
      deal.ownerName ?? "",
    ]),
  );
  const [draft, setDraft] = useState("");
  const [draftPriority, setDraftPriority] = useState<TaskPriority>("normal");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addItem = () => {
    const text = draft.trim();
    if (!text) return;
    setItems((prev) => [
      ...prev,
      { id: `new-${prev.length}-${Date.now()}`, text, done: false, priority: draftPriority },
    ]);
    setDraft("");
    setDraftPriority("normal");
  };

  const patch = (id: string, change: Partial<ChecklistItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...change } : i)));

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      // An unsubmitted draft is almost always meant to be kept.
      const pendingDraft = draft.trim();
      const finalItems = pendingDraft
        ? [...items, { id: "draft", text: pendingDraft, done: false, priority: draftPriority }]
        : items;
      const serialized = serializeChecklist(finalItems);

      // Everything but the checklist has to be resent verbatim — see toDealInput.
      await onSubmit(
        toDealInput(deal, {
          description: serialized || undefined,
          remark: serialized || undefined,
        }),
      );
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save checklist");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = items.filter((i) => !i.done).length;

  return (
    <Modal title="Deal Checklist" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-md">
        {error && <Alert>{error}</Alert>}

        <div className="flex items-center justify-between gap-sm rounded-md border border-line bg-surface-muted p-sm">
          <span className="text-sm font-medium text-fg">
            {deal.title?.trim() || deal.accountName?.trim() || "Untitled deal"}
          </span>
          <Badge tone={getStageMeta(deal.stage).tone} dot>
            {stageLabel(deal.stage)}
          </Badge>
        </div>

        <div className="flex flex-col gap-xs">
          <span className="text-xs font-medium text-fg-muted">
            Tasks{items.length > 0 && ` — ${pendingCount} pending, ${items.length - pendingCount} completed`}
          </span>

          {items.length === 0 && (
            <p className="py-sm text-sm italic text-fg-subtle">
              No tasks yet. Add the first one below.
            </p>
          )}

          <ul className="flex flex-col gap-xs">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-sm rounded-md border border-line bg-surface p-xs"
              >
                <PriorityCheck
                  priority={item.priority}
                  done={item.done}
                  label={item.text}
                  onToggle={() => patch(item.id, { done: !item.done })}
                />

                <input
                  value={item.text}
                  onChange={(e) => patch(item.id, { text: e.target.value })}
                  className={`min-w-0 flex-1 bg-transparent text-sm text-fg focus:outline-none ${
                    item.done ? "text-fg-subtle line-through" : ""
                  }`}
                />

                <PriorityPicker
                  value={item.priority}
                  onChange={(priority) => patch(item.id, { priority })}
                />

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove "${item.text}"`}
                  className="shrink-0 rounded p-1 text-fg-subtle transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-end gap-sm">
          <div className="flex-1">
            <Field
              label="Add a task"
              placeholder="Call the customer about pricing…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter adds another task rather than submitting the whole form.
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
              autoFocus
            />
          </div>
          <div className="flex items-center gap-sm pb-[2px]">
            <PriorityPicker value={draftPriority} onChange={setDraftPriority} />
            <Button type="button" variant="secondary" onClick={addItem} disabled={!draft.trim()}>
              Add
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-sm pt-xs">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save checklist"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * The round, priority-tinted tick. Colour carries the urgency and the same
 * control completes the task, so a row stays one circle and one line of text.
 */
function PriorityCheck({
  priority,
  done,
  label,
  onToggle,
}: {
  priority: TaskPriority;
  done: boolean;
  label: string;
  onToggle: () => void;
}) {
  const meta = PRIORITY_META[priority];
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={`${meta.label} priority — mark "${label}" done`}
      title={`${meta.label} priority`}
      onClick={onToggle}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${meta.ring} ${
        done ? meta.fill : "bg-transparent hover:scale-110"
      }`}
    >
      {done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
    </button>
  );
}

/** Cycles a task through the three priorities; the dot is the whole control. */
function PriorityPicker({
  value,
  onChange,
}: {
  value: TaskPriority;
  onChange: (next: TaskPriority) => void;
}) {
  const meta = PRIORITY_META[value];
  const next = TASK_PRIORITIES[(TASK_PRIORITIES.indexOf(value) + 1) % TASK_PRIORITIES.length];

  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={`${meta.label} priority — click for ${PRIORITY_META[next].label}`}
      className="flex shrink-0 items-center gap-1.5 rounded px-1.5 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-surface-muted"
    >
      <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </button>
  );
}
