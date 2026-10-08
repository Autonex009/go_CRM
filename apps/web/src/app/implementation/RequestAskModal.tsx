import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { Info, Send } from "lucide-react";

import { orgApi } from "../org/api";
import { memberGroups } from "../org/memberGroups";
import {
  Alert,
  AssigneePicker,
  Button,
  Field,
  Modal,
  SelectField,
  TextareaField,
} from "../ui";
import {
  ASK_PRIORITIES,
  implementationApi,
  type AskInput,
  type AskPriority,
  type Pipeline,
} from "./api";
import { PRIORITY_META } from "./meta";
import { StagedAttachments, uploadAttachment } from "./Attachments";
import { TypeSelect } from "./TypeSelect";

/**
 * A manager's ask request. Same fields as task creation, all optional — it can
 * be sent empty. Sales/admin review it on the Deals page and link the deal.
 */
export function RequestAskModal({
  pipelines,
  onClose,
  onCreated,
}: {
  pipelines: Pipeline[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const active = pipelines.filter((p) => !p.archivedAt);
  const [accountId, setAccountId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [detail, setDetail] = useState("");
  const [priority, setPriority] = useState<AskPriority>("p1");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [staged, setStaged] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const members = useQuery({
    queryKey: ["members"],
    queryFn: orgApi.members,
    staleTime: 5 * 60_000,
  });

  // Once created, a retry only re-uploads files; it never makes a second request.
  const savedId = useRef<string | null>(null);
  const create = useMutation({
    mutationFn: async (input: AskInput) => {
      if (!savedId.current) savedId.current = (await implementationApi.create(input)).id;
      for (const file of staged) await uploadAttachment(savedId.current, file);
    },
    onSuccess: onCreated,
    onError: (err) =>
      setError(
        savedId.current
          ? `Request sent, but a file failed to upload: ${err instanceof Error ? err.message : "unknown error"}`
          : err instanceof Error
            ? err.message
            : "Could not send that request",
      ),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate({
      accountId: accountId || undefined,
      title: title.trim(),
      type: type.trim(),
      detail: detail.trim(),
      priority,
      assignedTo: assignedTo || undefined,
      dueAt: dueAt ? `${dueAt}T00:00:00Z` : null,
    });
  };

  return (
    <Modal title="New ask request" onClose={onClose} size="lg">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="flex items-start gap-2 rounded-md bg-infoTone-soft px-3 py-2 text-xs text-infoTone-fg">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          Every field is optional. Sales or an admin will review the request,
          complete it if needed and link it to the right deal.
        </p>

        <SelectField
          label="Company"
          name="company"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="">Not sure yet</option>
          {active.map((p) => (
            <option key={p.accountId} value={p.accountId}>
              {p.accountName}
            </option>
          ))}
        </SelectField>

        <Field
          label="Title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Add PPE detection at the Pune plant"
          autoFocus
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <TypeSelect value={type} onChange={setType} />
          <AssigneePicker
            label="Assignee"
            groups={memberGroups(members.data ?? [], { roles: ["manager", "engineer"] })}
            value={assignedTo}
            onChange={setAssignedTo}
            placeholder="Unassigned"
            allowUnassigned
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-fg-muted">Priority</span>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-muted/60 p-1">
              {ASK_PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  aria-pressed={priority === p}
                  className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                    priority === p ? PRIORITY_META[p].chip : "text-fg-muted hover:text-fg"
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
        </div>

        <TextareaField
          label="Details"
          name="detail"
          rows={3}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="What's needed, for whom, and why…"
        />

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-fg-muted">Attach</span>
          <StagedAttachments files={staged} onChange={setStaged} />
        </div>

        {error && <Alert>{error}</Alert>}

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            <Send className="h-3.5 w-3.5" /> Request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
