import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";

import { ApiError } from "../lib/api";
import { zodResolver } from "../lib/zodResolver";
import { memberLabel, orgApi } from "../org/api";
import { Alert, Badge, Button, Field, Modal, SelectField, TextareaField } from "../ui";
import type { Lead, LeadInput } from "./api";
import { leadFormSchema, toPayload, type LeadFormValues } from "./schemas";
import { LEAD_SOURCES, LEAD_STAGES, STAGE_META, stageLabel, type LeadStage } from "./stages";

interface LeadDialogProps {
  /** Existing lead to edit, or null to create. */
  lead: Lead | null;
  /** Column the new lead starts in (create mode). */
  defaultStage: LeadStage;
  onClose: () => void;
  onSubmit: (input: LeadInput) => Promise<unknown>;
  onDelete?: () => void;
}

/** Create/edit form. One dialog for both, since the field set is identical. */
export function LeadDialog({ lead, defaultStage, onClose, onSubmit, onDelete }: LeadDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);

  // Populates the owner picker. Members are stable, so this is usually a cache
  // hit shared with the Team page.
  const members = useQuery({
    queryKey: ["members"],
    queryFn: orgApi.members,
    staleTime: 5 * 60_000,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      firstName: lead?.firstName ?? "",
      lastName: lead?.lastName ?? "",
      email: lead?.email ?? "",
      phone: lead?.phone ?? "",
      company: lead?.company ?? "",
      source: lead?.source ?? "",
      notes: lead?.notes ?? "",
      value: lead?.value ?? undefined,
      stage: lead?.stage ?? defaultStage,
      ownerUserId: lead?.ownerUserId ?? "",
    },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(toPayload(values));
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save this lead");
    }
  });

  return (
    <Modal
      title={lead ? "Edit lead" : "New lead"}
      onClose={onClose}
      headerAction={
        onDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <span className="text-danger-600">Delete</span>
          </Button>
        )
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-md" noValidate>
        {formError && <Alert>{formError}</Alert>}

        {lead && (
          <div className="flex items-center gap-sm">
            <Badge tone={STAGE_META[lead.stage].tone} dot>
              {stageLabel(lead.stage)}
            </Badge>
            <span className="text-xs text-neutral-400">
              Created {new Date(lead.createdAt).toLocaleDateString()}
            </span>
          </div>
        )}

        <div className="grid gap-md sm:grid-cols-2">
          <Field label="Name" error={errors.firstName?.message} {...register("firstName")} />
          <Field label="Last name" error={errors.lastName?.message} {...register("lastName")} />
          <Field label="Email" type="email" error={errors.email?.message} {...register("email")} />
          <Field label="Phone" type="tel" error={errors.phone?.message} {...register("phone")} />
          <Field label="Company" error={errors.company?.message} {...register("company")} />
          <Field
            label="Estimated value"
            type="number"
            min={0}
            step="any"
            error={errors.value?.message}
            {...register("value", { valueAsNumber: true })}
          />

          <SelectField label="Stage" error={errors.stage?.message} {...register("stage")}>
            {LEAD_STAGES.map((stage) => (
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

          <SelectField label="Source" error={errors.source?.message} {...register("source")}>
            <option value="">—</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectField>
        </div>

        <TextareaField label="Notes" rows={3} error={errors.notes?.message} {...register("notes")} />

        <div className="flex justify-end gap-sm">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : lead ? "Save changes" : "Create lead"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
