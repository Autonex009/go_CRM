import { useState } from "react";

import { formatMoney } from "../lib/money";
import { ApiError } from "../lib/api";
import { useCurrency } from "../org/workspace";
import { Alert, Avatar, Badge, Button, Field, Icon, Modal, TextareaField } from "../ui";
import { leadCompany, leadName, type ConvertInput, type Lead } from "./api";

interface ConvertDialogProps {
  lead: Lead;
  onClose: () => void;
  onSubmit: (input: ConvertInput) => Promise<unknown>;
}

/**
 * Lead → Deal conversion (brief §3.4).
 *
 * The split the mockup makes — "pre-filled from lead" above, "you fill in" below
 * — is the whole point: what carries over is shown as read-only context so the
 * person doesn't retype it, and the four things only they know get the focus.
 */
export function ConvertDialog({ lead, onClose, onSubmit }: ConvertDialogProps) {
  const currency = useCurrency();

  // The deal name defaults to the company, which is what it is usually called.
  const [dealTitle, setDealTitle] = useState(leadCompany(lead) ?? leadName(lead));
  const [amount, setAmount] = useState(lead.value ? String(lead.value) : "");
  const [expectedClose, setExpectedClose] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsedAmount = amount.trim() === "" ? undefined : Number(amount);
  const amountInvalid = parsedAmount !== undefined && (Number.isNaN(parsedAmount) || parsedAmount < 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealTitle.trim()) {
      setError("Give the deal a name");
      return;
    }
    if (amountInvalid) {
      setError("Enter a valid amount");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        dealTitle: dealTitle.trim(),
        amount: parsedAmount,
        expectedCloseDate: expectedClose ? `${expectedClose}T00:00:00Z` : undefined,
        callNotes: callNotes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not convert this lead");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Convert to deal" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-lg" noValidate>
        {error && <Alert>{error}</Alert>}

        <p className="flex items-start gap-sm rounded-md bg-ok-soft px-md py-sm text-sm text-ok-fg">
          <Icon name="check" size={15} className="mt-[2px] shrink-0" />
          <span>
            This lead will be marked <strong>Converted</strong> and a new Deal record created
            automatically.
          </span>
        </p>

        <section className="flex flex-col gap-sm">
          <h3 className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
            Pre-filled from lead
          </h3>

          <div className="flex items-center gap-sm rounded-md border border-line bg-surface-muted px-md py-sm">
            <Avatar name={leadName(lead)} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">
                {leadName(lead)}
                {leadCompany(lead) ? ` — ${leadCompany(lead)}` : ""}
              </p>
              {lead.title && <p className="truncate text-xs text-fg-muted">{lead.title}</p>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-sm text-xs text-fg-muted">
            <span>
              Deal stage <Badge tone="neutral">Discovery</Badge>
            </span>
            {lead.source && (
              <span>
                Source <Badge tone="neutral">{lead.source}</Badge>
              </span>
            )}
            {lead.ownerEmail && <span>Owner carried over</span>}
          </div>
        </section>

        <section className="flex flex-col gap-md">
          <h3 className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
            You fill in
          </h3>

          <Field
            label="Deal name"
            name="dealTitle"
            value={dealTitle}
            onChange={(e) => setDealTitle(e.target.value)}
            placeholder="e.g. Jubilant EHS assessment"
          />

          <div className="grid gap-md sm:grid-cols-2">
            <Field
              label={`Estimated value (${currency})`}
              name="amount"
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
            <Field
              label="Expected close"
              name="expectedClose"
              type="date"
              value={expectedClose}
              onChange={(e) => setExpectedClose(e.target.value)}
            />
          </div>

          <TextareaField
            label="Call notes (from demo)"
            name="callNotes"
            rows={3}
            value={callNotes}
            onChange={(e) => setCallNotes(e.target.value)}
            placeholder="Key points from the call, interest level, next steps…"
          />
          <p className="-mt-sm text-xs text-fg-subtle">
            Saved to the timeline, so it stays with the deal.
          </p>
        </section>

        {parsedAmount !== undefined && !amountInvalid && parsedAmount > 0 && (
          <p className="text-xs text-fg-muted">
            Deal will open at {formatMoney(parsedAmount, currency)}.
          </p>
        )}

        <div className="flex justify-end gap-sm">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create deal"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
