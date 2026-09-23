import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";

import { ApiError } from "../lib/api";
import { memberLabel, orgApi } from "../org/api";
import {
  Alert,
  Avatar,
  Button,
  Field,
  Modal,
  SelectField,
  TextareaField,
} from "../ui";
import {
  ASK_PRIORITIES,
  ASK_STATUSES,
  type Ask,
  type AskInput,
  type AskPriority,
  type AskStatus,
} from "./api";
import { AskHistory } from "./AskHistory";
import { TypeSelect } from "./TypeSelect";
import {
  Attachments,
  StagedAttachments,
  uploadAttachment,
} from "./Attachments";
import { PRIORITY_META, STATUS_META } from "./meta";

/** What the deal or lead already knows, shown read-only at the top. */
export interface AskParent {
  dealId?: string;
  leadId?: string;
  /** "Hikal — Ankleshwar Plant · VIGIL + Digital" */
  label: string;
  /** Company name, for the avatar and the banner. */
  company: string;
}

export function AskDialog({
  parent,
  ask,
  onClose,
  onSubmit,
  onStatusChange,
  onDelete,
}: {
  parent: AskParent;
  /** Null when raising a new ask. */
  ask: Ask | null;
  onClose: () => void;
  /** Resolves to the saved ask, so files staged before it existed can be
   *  uploaded against its id. */
  onSubmit: (input: AskInput) => Promise<Ask>;
  /** Moves an existing ask. Verified and Won't do live only here — the board
   *  draws the five open columns. */
  onStatusChange?: (status: AskStatus, reason: string) => Promise<unknown>;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(ask?.title ?? "");
  const [type, setType] = useState(ask?.type ?? "");
  const [priority, setPriority] = useState<AskPriority>(ask?.priority ?? "p0");
  const [assignedTo, setAssignedTo] = useState(ask?.assignedTo ?? "");
  const [dueAt, setDueAt] = useState(ask?.dueAt?.slice(0, 10) ?? "");
  const [detail, setDetail] = useState(ask?.detail ?? "");
  const [staged, setStaged] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const members = useQuery({
    queryKey: ["members"],
    queryFn: orgApi.members,
    staleTime: 5 * 60_000,
  });

  const values = (): AskInput => ({
    dealId: parent.dealId,
    leadId: parent.leadId,
    title: title.trim(),
    type: type.trim(),
    detail: detail.trim(),
    priority,
    assignedTo: assignedTo || undefined,
    dueAt: dueAt ? `${dueAt}T00:00:00Z` : null,
  });

  /**
   * Moves the ask, saving whatever is on the form first.
   *
   * Without the save, picking a status threw away anything typed since the
   * dialog opened — the move closed it and the edits went with it.
   */
  const changeStatus = async (next: AskStatus) => {
    if (!onStatusChange || !title.trim()) return;
    const reason =
      next === "blocked"
        ? window.prompt("What is it blocked on?")?.trim() ?? ""
        : "";

    setBusy(true);
    setError(null);
    try {
      await onSubmit(values());
      await onStatusChange(next, reason);
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Could not move that ask",
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give the ask a one-line title.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await onSubmit(values());

      // Files chosen before the ask existed. The ask is already saved, so a
      // failed upload reports itself rather than discarding what was written.
      for (const file of staged) {
        await uploadAttachment(saved.id, file);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Could not save that ask",
      );
    } finally {
      setBusy(false);
    }
  };

  const assigneeName =
    (members.data ?? []).find((m) => m.id === assignedTo)?.name ?? "";

  return (
    <Modal
      title={ask ? "Implementation ask" : "New implementation ask"}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={submit} className="flex flex-col gap-md">
        <p className="flex items-start gap-sm rounded-md bg-ok-soft px-md py-sm text-xs text-ok-fg">
          <Check className="mt-[1px] h-3.5 w-3.5 shrink-0" />
          <span>
            This creates a tech ask linked to{" "}
            <strong className="font-semibold">{parent.company}</strong> and
            notifies {assigneeName ? assigneeName : "the assignee"}.
          </span>
        </p>

        <div className="flex flex-col gap-xs">
          <span className="text-xs font-medium text-fg-muted">
            {parent.leadId ? "Lead · pre-filled" : "Deal · pre-filled"}
          </span>
          <div className="flex items-center gap-sm rounded-md border border-line bg-surface-muted px-md py-sm">
            <Avatar name={parent.company || parent.label} size="sm" />
            <span className="min-w-0 truncate text-sm text-fg">{parent.label}</span>
          </div>
        </div>

        <Field
          label="Title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Build the 3 Hikal use-cases (spill, PPE, zone-intrusion)"
          autoFocus
        />

        {ask && onStatusChange && (
          <SelectField
            label="Status"
            name="status"
            value={ask.status}
            disabled={busy}
            onChange={(e) => void changeStatus(e.target.value as AskStatus)}
          >
            {ASK_STATUSES.map((st) => (
              <option key={st} value={st}>
                {STATUS_META[st].label}
              </option>
            ))}
          </SelectField>
        )}

        <div className="grid gap-md sm:grid-cols-2">
          <TypeSelect value={type} onChange={setType} />

          <SelectField
            label="Assign to"
            name="assignedTo"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          >
            <option value="">Unassigned</option>
            {(members.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {memberLabel(m)}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="flex flex-col gap-xs">
          <span className="text-xs font-medium text-fg-muted">Priority</span>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-muted/60 p-1">
            {ASK_PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                aria-pressed={priority === p}
                className={`rounded-lg px-md py-1.5 text-sm font-medium transition-colors ${
                  priority === p
                    ? PRIORITY_META[p].chip
                    : "text-fg-muted hover:text-fg"
                }`}
              >
                {PRIORITY_META[p].label}
              </button>
            ))}
          </div>
        </div>

        <Field
          label="Due date"
          name="dueAt"
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />

        <div className="flex flex-col gap-xs">
          <span className="text-xs font-medium text-fg-muted">Attach</span>
          {ask ? (
            <Attachments askId={ask.id} />
          ) : (
            <StagedAttachments files={staged} onChange={setStaged} />
          )}
        </div>

        <TextareaField
          label="Details for the tech team"
          name="detail"
          rows={4}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Scope, what the client actually asked for, links…"
        />

        {error && <Alert>{error}</Alert>}

        {ask && <AskHistory askId={ask.id} />}

        <div className="flex items-center justify-between gap-md border-t border-line pt-md">
          {onDelete ? (
            <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-sm">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} icon="check">
              {ask ? "Save" : "Create ask"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

