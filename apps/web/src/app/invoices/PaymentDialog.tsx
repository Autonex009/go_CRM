import { useState } from "react";

import { ApiError } from "../lib/api";
import { formatMoneyExact } from "../lib/money";
import { Alert, Button, Field, Modal, SelectField, TextareaField } from "../ui";
import type { Invoice, PaymentInput } from "./api";

const METHODS = ["Bank transfer", "Card", "Cash", "Cheque", "Other"] as const;

interface PaymentDialogProps {
  invoice: Invoice;
  onClose: () => void;
  onSubmit: (input: PaymentInput) => Promise<unknown>;
}

/**
 * Record a receipt against an invoice.
 *
 * The amount defaults to the outstanding balance, because settling in full is
 * the common case and retyping a figure you can see on screen is an easy way to
 * enter the wrong one. Partial payments are allowed — the server recomputes the
 * balance and settles the invoice automatically once it is covered.
 */
export function PaymentDialog({ invoice, onClose, onSubmit }: PaymentDialogProps) {
  const [amount, setAmount] = useState(() => (invoice.balance > 0 ? String(invoice.balance) : ""));
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<string>(METHODS[0]);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = Number(amount);
  const valid = amount.trim() !== "" && !Number.isNaN(parsed) && parsed > 0;
  // Overpaying is allowed (a customer really can send too much), but it's worth
  // pointing out before it's recorded.
  const overpay = valid && parsed > invoice.balance;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      setError("Enter an amount greater than zero");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        amount: parsed,
        paidOn: paidOn ? `${paidOn}T00:00:00Z` : undefined,
        method: method || undefined,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record that payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Record a payment · ${invoice.number}`} onClose={onClose} size="sm">
      <form onSubmit={submit} className="flex flex-col gap-md" noValidate>
        {error && <Alert>{error}</Alert>}

        <div className="flex items-center justify-between rounded-md bg-surface-muted px-md py-sm text-sm">
          <span className="text-fg-muted">Outstanding</span>
          <span className="font-semibold tabular-nums text-fg">
            {formatMoneyExact(invoice.balance, invoice.currency)}
          </span>
        </div>

        <Field
          label={`Amount (${invoice.currency})`}
          name="amount"
          type="number"
          min={0}
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {overpay && (
          <p className="-mt-xs text-xs text-warn-fg">
            That is more than the outstanding balance — it will be recorded as an overpayment.
          </p>
        )}

        <div className="grid gap-md sm:grid-cols-2">
          <Field
            label="Received on"
            name="paidOn"
            type="date"
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
          />
          <SelectField
            label="Method"
            name="method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </SelectField>
        </div>

        <Field
          label="Reference"
          name="reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Transaction id, cheque number…"
        />
        <TextareaField
          label="Note"
          name="note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex justify-end gap-sm">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !valid}>
            {saving ? "Recording…" : "Record payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
