import { useState } from "react";

import { ApiError } from "../lib/api";
import { Alert, Badge, Button, Modal, TextareaField } from "../ui";
import type { Deal, DealInput } from "./api";
import { getStageMeta, stageLabel } from "./stages";

interface RemarkDialogProps {
  deal: Deal;
  onClose: () => void;
  onSubmit: (input: DealInput) => Promise<unknown>;
}

export function RemarkDialog({ deal, onClose, onSubmit }: RemarkDialogProps) {
  const [remark, setRemark] = useState(deal.remark ?? deal.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const trimmed = remark.trim();
      await onSubmit({
        title: deal.title,
        amount: deal.amount,
        stage: deal.stage,
        description: trimmed || undefined,
        remark: trimmed || undefined,
        ownerUserId: deal.ownerUserId ?? undefined,

        accountId: deal.accountId ?? undefined,
        expectedCloseDate: deal.expectedCloseDate ?? undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save remark");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Deal Remark" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-md">
        {error && <Alert>{error}</Alert>}

        <div className="flex flex-col gap-xs rounded-md bg-surface-muted p-sm border border-line">
          <div className="flex items-center justify-between gap-sm">
            <span className="font-medium text-sm text-fg">{deal.title}</span>
            <Badge tone={getStageMeta(deal.stage).tone} dot>
              {stageLabel(deal.stage)}
            </Badge>
          </div>

        </div>

        <TextareaField
          label="Remark / Notes"
          placeholder="Add important remarks, customer updates, or notes about this deal…"
          rows={4}
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          autoFocus
        />

        <div className="flex justify-end gap-sm pt-xs">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save Remark"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
