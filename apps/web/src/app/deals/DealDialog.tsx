import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AccountSelect } from "../accounts/AccountSelect";
import { contactName, contactsApi } from "../contacts/api";
import { ApiError } from "../lib/api";
import { zodResolver } from "../lib/zodResolver";
import { memberLabel, orgApi } from "../org/api";
import { Alert, Badge, Button, Field, Modal, SelectField, TextareaField } from "../ui";
import type { Deal, DealInput } from "./api";
import { dealFormSchema, toPayload, type DealFormValues } from "./schemas";
import { DEAL_STAGES, STAGE_META, stageLabel, type DealStage } from "./stages";

interface DealDialogProps {
  /** Existing deal to edit, or null to create. */
  deal: Deal | null;
  /** Column the new deal starts in (create mode). */
  defaultStage: DealStage;
  onClose: () => void;
  onSubmit: (input: DealInput) => Promise<unknown>;
  onDelete?: () => void;
}

/** Create/edit form. One dialog for both, since the field set is identical. */
export function DealDialog({ deal, defaultStage, onClose, onSubmit, onDelete }: DealDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);

  // Both pickers reuse queries the rest of the app already caches.
  const members = useQuery({
    queryKey: ["members"],
    queryFn: orgApi.members,
    staleTime: 5 * 60_000,
  });
  const contacts = useQuery({
    queryKey: ["contacts", 0],
    queryFn: () => contactsApi.list(0),
    staleTime: 60_000,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DealFormValues>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      title: deal?.title ?? "",
      description: deal?.description ?? "",
      amount: deal?.amount ?? 0,
      stage: deal?.stage ?? defaultStage,
      ownerUserId: deal?.ownerUserId ?? "",
      contactId: deal?.contactId ?? "",
      // A native date input needs exactly YYYY-MM-DD.
      expectedCloseDate: deal?.expectedCloseDate?.slice(0, 10) ?? "",
      accountId: deal?.accountId ?? "",
    },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(toPayload(values));
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save this deal");
    }
  });

  return (
    <Modal
      title={deal ? "Edit deal" : "New deal"}
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

        {deal && (
          <div className="flex items-center gap-sm">
            <Badge tone={STAGE_META[deal.stage].tone} dot>
              {stageLabel(deal.stage)}
            </Badge>
            <span className="text-xs text-fg-subtle">
              Created {new Date(deal.createdAt).toLocaleDateString()}
            </span>
          </div>
        )}

        <Field label="Title" error={errors.title?.message} {...register("title")} />

        <div className="grid gap-md sm:grid-cols-2">
          <Field
            label="Amount"
            type="number"
            min={0}
            step="any"
            error={errors.amount?.message}
            {...register("amount", { valueAsNumber: true })}
          />
          <Field
            label="Expected close"
            type="date"
            error={errors.expectedCloseDate?.message}
            {...register("expectedCloseDate")}
          />

          <SelectField label="Stage" error={errors.stage?.message} {...register("stage")}>
            {DEAL_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stageLabel(stage)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Owner"
            error={errors.ownerUserId?.message}
            {...register("ownerUserId")}
          >
            <option value="">Unassigned</option>
            {(members.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {memberLabel(m)}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="grid gap-md sm:grid-cols-2">
          <SelectField label="Contact" error={errors.contactId?.message} {...register("contactId")}>
            <option value="">—</option>
            {(contacts.data?.items ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {contactName(c)}
              </option>
            ))}
          </SelectField>

          <AccountSelect error={errors.accountId?.message} {...register("accountId")} />
        </div>

        <TextareaField
          label="Description"
          rows={3}
          error={errors.description?.message}
          {...register("description")}
        />

        <div className="flex justify-end gap-sm">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : deal ? "Save changes" : "Create deal"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
