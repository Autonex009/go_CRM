import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { AccountSelect } from "../accounts/AccountSelect";
import { leadsApi } from "../leads/api";
import { ApiError } from "../lib/api";
import { zodResolver } from "../lib/zodResolver";
import { memberLabel, orgApi } from "../org/api";
import { Alert, Button, Field, Modal, SelectField } from "../ui";
import { ACTION_STATUSES, ACTION_STATUS_LABEL, type Action, type ActionUpdateInput } from "./api";
import { actionFormSchema, toPayload, type ActionFormValues } from "./schemas";

interface ActionDialogProps {
  /** Existing action to edit, or null to create. */
  action: Action | null;
  /** Pre-fills the client when opened from a Company Profile page. */
  defaultAccountId?: string;
  onClose: () => void;
  onSubmit: (input: ActionUpdateInput) => Promise<unknown>;
  onDelete?: () => void;
}

/** Create/edit form. One dialog for both, since the field set is identical. */
export function ActionDialog({ action, defaultAccountId, onClose, onSubmit, onDelete }: ActionDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const members = useQuery({
    queryKey: ["members"],
    queryFn: orgApi.members,
    staleTime: 5 * 60_000,
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ActionFormValues>({
    resolver: zodResolver(actionFormSchema),
    defaultValues: {
      title: action?.title ?? "",
      dueDate: action?.dueAt?.slice(0, 10) ?? "",
      assignedTo: action?.assignedTo ?? "",
      accountId: action?.accountId ?? defaultAccountId ?? "",
      leadId: action?.leadId ?? "",
      status: action?.status ?? "open",
    },
  });

  const accountId = useWatch({
    control,
    name: "accountId",
  });

  // The picker asks the server for the leads it needs, matching DealDialog exactly.
  // Once a company is chosen it fetches that company's leads (limit 1000).
  // With no company chosen yet it takes the same page across the workspace to browse.
  const allLeads = useQuery({
    queryKey: ["leads", "picker", accountId ?? ""],
    queryFn: () => leadsApi.list(0, "", 1000, accountId ? { accountId } : {}),
    staleTime: 60_000,
  });

  const leadId = useWatch({ control, name: "leadId" });
  const selectableLeads = allLeads.data?.items ?? [];

  // When a lead is selected and it belongs to a company, auto-fill the client if not selected
  useEffect(() => {
    if (leadId && allLeads.data) {
      const selectedLead = allLeads.data.items.find((l) => l.id === leadId);
      if (selectedLead && selectedLead.accountId && !accountId) {
        setValue("accountId", selectedLead.accountId);
      }
    }
  }, [leadId, allLeads.data, setValue, accountId]);

  // Switching account clears leadId if it doesn't belong to the newly chosen account
  useEffect(() => {
    if (!leadId || allLeads.isFetching || !allLeads.data) return;
    if (!selectableLeads.some((l) => l.id === leadId)) {
      setValue("leadId", "");
    }
  }, [selectableLeads, leadId, allLeads.data, allLeads.isFetching, setValue]);

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(toPayload(values));
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save this action");
    }
  });

  return (
    <Modal
      title={action ? "Edit action" : "New action"}
      onClose={onClose}
      headerAction={
        onDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <span className="text-bad-fg">Delete</span>
          </Button>
        )
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-md" noValidate>
        {formError && <Alert>{formError}</Alert>}

        <Field label="Title" error={errors.title?.message} {...register("title")} />

        <div className="grid gap-md sm:grid-cols-2">
          <Field
            label="Due date"
            type="date"
            error={errors.dueDate?.message}
            {...register("dueDate")}
          />

          <SelectField label="Assignee" error={errors.assignedTo?.message} {...register("assignedTo")}>
            <option value="">Unassigned</option>
            {(members.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {memberLabel(m)}
              </option>
            ))}
          </SelectField>
        </div>

        <AccountSelect
          label="Client"
          error={errors.accountId?.message}
          {...register("accountId")}
        />

        <div>
          <SelectField
            label="Lead (optional)"
            error={errors.leadId?.message}
            {...register("leadId")}
          >
            {accountId ? (
              selectableLeads.length > 0 ? (
                <>
                  <option value="">
                    — Select Lead ({selectableLeads.length} available) —
                  </option>
                  {selectableLeads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.firstName} {l.lastName ?? ""} {l.title ? `(${l.title})` : ""}
                    </option>
                  ))}
                </>
              ) : (
                <option value="">No leads found for this company</option>
              )
            ) : (
              <>
                <option value="">
                  — Select Lead (or choose company above to filter) —
                </option>
                {selectableLeads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.firstName} {l.lastName ?? ""} {l.title ? `(${l.title})` : ""}{" "}
                    {l.company ? `— ${l.company}` : ""}
                  </option>
                ))}
              </>
            )}
          </SelectField>
        </div>

        {action && (
          <SelectField label="Status" error={errors.status?.message} {...register("status")}>
            {ACTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ACTION_STATUS_LABEL[s]}
              </option>
            ))}
          </SelectField>
        )}

        <div className="flex justify-end gap-sm">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : action ? "Save changes" : "Create action"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
