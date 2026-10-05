import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";

import { accountsApi } from "../accounts/api";
import { ApiError } from "../lib/api";
import { memberLabel, orgApi } from "../org/api";
import { Alert, Button, Field, Modal, SelectField, TextareaField } from "../ui";
import { implementationApi, type Pipeline } from "./api";

interface PipelineDialogProps {
  /** Null to open a new pipeline. */
  pipeline: Pipeline | null;
  /** Companies that already have one, so the picker does not offer them. */
  takenAccountIds: Set<string>;
  /** Open asks currently in this pipeline, for the archive warning. */
  openAsks?: number;
  onClose: () => void;
}

/**
 * Opens or edits a company's implementation pipeline. Only admin, sales and
 * account managers see it; the server refuses everyone else regardless.
 * Archiving hides a pipeline from the board — nothing is ever deleted.
 */
export function PipelineDialog({
  pipeline,
  takenAccountIds,
  openAsks = 0,
  onClose,
}: PipelineDialogProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [accountId, setAccountId] = useState(pipeline?.accountId ?? "");
  const [managerId, setManagerId] = useState(pipeline?.managerId ?? "");
  const [description, setDescription] = useState(pipeline?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const companies = useQuery({
    queryKey: ["pipelineCompanyPicker", debounced],
    queryFn: () => accountsApi.list(0, 25, debounced),
    enabled: !pipeline,
  });

  const members = useQuery({
    queryKey: ["members"],
    queryFn: orgApi.members,
    staleTime: 5 * 60_000,
  });
  const managers = (members.data ?? []).filter((m) => m.role === "manager");

  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ["implementationPipelines"] });
    void queryClient.invalidateQueries({ queryKey: ["implementation"] });
    onClose();
  };
  const fail = (err: unknown) =>
    setError(err instanceof ApiError || err instanceof Error ? err.message : "Could not save that pipeline");

  const create = useMutation({
    mutationFn: () =>
      implementationApi.createPipeline({
        accountId,
        managerId: managerId || null,
        description: description.trim(),
      }),
    onSuccess: done,
    onError: fail,
  });

  const update = useMutation({
    mutationFn: (archived?: boolean) =>
      implementationApi.updatePipeline(pipeline!.id, {
        // Only what this dialog changed, so a save cannot undo someone
        // else's edit made while it was open.
        ...(managerId !== (pipeline!.managerId ?? "") ? { managerId } : {}),
        ...(description.trim() !== pipeline!.description ? { description: description.trim() } : {}),
        ...(archived === undefined ? {} : { archived }),
      }),
    onSuccess: done,
    onError: fail,
  });

  const busy = create.isPending || update.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pipeline) {
      update.mutate(undefined);
      return;
    }
    if (!accountId) {
      setError("Pick the company this pipeline is for.");
      return;
    }
    create.mutate();
  };

  const options = (companies.data?.items ?? []).filter((c) => !takenAccountIds.has(c.id));

  return (
    <Modal title={pipeline ? `${pipeline.accountName} pipeline` : "New company pipeline"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-md">
        {pipeline ? (
          <div className="flex flex-col gap-xs">
            <span className="text-xs font-medium text-fg-muted">Company</span>
            <div className="rounded-md border border-line bg-surface-muted px-md py-sm text-sm text-fg">
              {pipeline.accountName}
              {pipeline.locations && (
                <span className="block text-xs text-fg-muted">{pipeline.locations}</span>
              )}
            </div>
          </div>
        ) : (
          <>
            <Field
              label="Find company"
              name="companySearch"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Start typing a company name…"
              autoFocus
            />
            <SelectField
              label="Company"
              name="accountId"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">
                {companies.isPending ? "Loading companies…" : "Select a company"}
              </option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
          </>
        )}

        <SelectField
          label="Engineering manager"
          name="managerId"
          value={managerId}
          onChange={(e) => setManagerId(e.target.value)}
        >
          <option value="">No manager yet</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {memberLabel(m)}
            </option>
          ))}
        </SelectField>
        <p className="-mt-2 text-xs text-fg-subtle">
          The manager sees and moves every card in this company's pipeline.
        </p>

        <TextareaField
          label="What the engineering team should know"
          name="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Scope of the engagement, key contacts' expectations, go-live dates…"
        />

        {error && <Alert>{error}</Alert>}

        <div className="flex items-center justify-between gap-md border-t border-line pt-md">
          {pipeline ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                const archiving = !pipeline.archivedAt;
                if (
                  archiving &&
                  openAsks > 0 &&
                  !window.confirm(
                    `${pipeline.accountName} has ${openAsks} open ask${openAsks === 1 ? "" : "s"}. ` +
                      "Archiving hides them from the board (nothing is deleted, and a new ask reopens it). Archive anyway?",
                  )
                ) {
                  return;
                }
                update.mutate(archiving);
              }}
            >
              {pipeline.archivedAt ? "Restore pipeline" : "Archive pipeline"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-sm">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} icon="check">
              {pipeline ? "Save" : "Create pipeline"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
