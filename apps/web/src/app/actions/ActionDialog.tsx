import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AccountSelect } from "../accounts/AccountSelect";
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
    formState: { errors, isSubmitting },
  } = useForm<ActionFormValues>({
    resolver: zodResolver(actionFormSchema),
    defaultValues: {
      title: action?.title ?? "",
      dueDate: action?.dueAt?.slice(0, 10) ?? "",
      assignedTo: action?.assignedTo ?? "",
      accountId: action?.accountId ?? defaultAccountId ?? "",
      status: action?.status ?? "open",
    },
  });

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

        <div className="grid gap-md sm:grid-cols-2">
          <AccountSelect label="Client" error={errors.accountId?.message} {...register("accountId")} />

          {action && (
            <SelectField label="Status" error={errors.status?.message} {...register("status")}>
              {ACTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ACTION_STATUS_LABEL[s]}
                </option>
              ))}
            </SelectField>
          )}
        </div>

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
