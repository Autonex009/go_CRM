import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";

import { Button, Modal, TextareaField } from "../ui";
import type { Ask } from "./api";
import { parentName } from "./meta";

interface BlockReasonModalProps {
  ask: Ask;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function BlockReasonModal({
  ask,
  onConfirm,
  onCancel,
}: BlockReasonModalProps) {
  const [reason, setReason] = useState(ask.blockedReason || "");
  const [error, setError] = useState<string | null>(null);

  // Capture phase escape listener: prevents closing an underlying modal if nested
  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [onCancel]);

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("A blockage reason is mandatory to move this card to Blocked.");
      return;
    }
    onConfirm(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Modal title="Block Task" onClose={onCancel} size="sm" zIndex="z-[60]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-md">
        <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface-muted/60 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            {parentName(ask)}
          </span>
          <p className="text-sm font-medium text-fg">{ask.title}</p>
        </div>

        <TextareaField
          label="Blockage reason"
          name="blockedReason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="State why this card is blocked... (Cmd+Enter / Ctrl+Enter to submit)"
          rows={3}
          autoFocus
          error={error ?? undefined}
        />

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Confirm Block
          </Button>
        </div>
      </form>
    </Modal>
  );
}
