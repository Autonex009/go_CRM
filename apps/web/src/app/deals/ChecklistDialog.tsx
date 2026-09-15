import { useState } from "react";
import { Trash2 } from "lucide-react";

import { ApiError } from "../lib/api";
import { Alert, Badge, Button, Field, Modal } from "../ui";
import type { Deal, DealInput } from "./api";
import {
  parseChecklist,
  serializeChecklist,
  type ChecklistItem,
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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addItem = () => {
    const text = draft.trim();
    if (!text) return;
    setItems((prev) => [
      ...prev,
      { id: `new-${prev.length}-${Date.now()}`, text, done: false },
    ]);
    setDraft("");
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
        ? [...items, { id: "draft", text: pendingDraft, done: false }]
        : items;
      const serialized = serializeChecklist(finalItems);

      await onSubmit({
        title: deal.title,
        amount: deal.amount,
        stage: deal.stage,
        description: serialized || undefined,
        remark: serialized || undefined,
        ownerUserId: deal.ownerUserId ?? undefined,
        accountId: deal.accountId ?? undefined,
        expectedCloseDate: deal.expectedCloseDate ?? undefined,
      });
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
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) => patch(item.id, { done: e.target.checked })}
                  aria-label={`Mark "${item.text}" done`}
                  className="h-4 w-4 shrink-0 accent-indigo-600"
                />

                <input
                  value={item.text}
                  onChange={(e) => patch(item.id, { text: e.target.value })}
                  className={`min-w-0 flex-1 bg-transparent text-sm text-fg focus:outline-none ${
                    item.done ? "text-fg-subtle line-through" : ""
                  }`}
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
          <Button type="button" variant="secondary" onClick={addItem} disabled={!draft.trim()}>
            Add
          </Button>
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
