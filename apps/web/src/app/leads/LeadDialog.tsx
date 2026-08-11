import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AccountSelect } from "../accounts/AccountSelect";
import { Timeline } from "../activities/Timeline";
import { ApiError } from "../lib/api";
import { zodResolver } from "../lib/zodResolver";
import { memberLabel, orgApi } from "../org/api";
import { Alert, Badge, Button, Field, Modal, SelectField, TextareaField } from "../ui";
import { LEAD_STAGES, STAGE_META, stageLabel, type Lead, type LeadInput } from "./api";
import { leadFormSchema, toPayload, type LeadFormValues } from "./schemas";

/** Lead sources offered in the form. Free text on the server, a list here. */
const LEAD_SOURCES = [
  "Website",
  "Referral",
  "Cold outreach",
  "LinkedIn",
  "Event",
  "Inbound call",
  "Partner",
  "Other",
] as const;

interface LeadDialogProps {
  /** Existing lead to edit, or null to create. */
  lead: Lead | null;
  onClose: () => void;
  onSubmit: (input: LeadInput) => Promise<unknown>;
  onDelete?: () => void;
}

/** Create/edit form. One dialog for both, since the field set is identical. */
export function LeadDialog({ lead, onClose, onSubmit, onDelete }: LeadDialogProps) {
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
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      firstName: lead?.firstName ?? "",
      lastName: lead?.lastName ?? "",
      title: lead?.title ?? "",
      email: lead?.email ?? "",
      phone: lead?.phone ?? "",
      linkedinUrl: lead?.linkedinUrl ?? "",
      accountId: lead?.accountId ?? "",
      company: lead?.company ?? "",
      source: lead?.source ?? "",
      notes: lead?.notes ?? "",
      value: lead?.value ?? undefined,
      stage: lead?.stage ?? "new",
      ownerUserId: lead?.ownerUserId ?? "",
      followUpAt: lead?.followUpAt?.slice(0, 10) ?? "",
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

  const converted = Boolean(lead?.convertedAt);

  return (
    <Modal
      title={lead ? "Edit lead" : "New lead"}
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

        {lead && (
          <div className="flex flex-wrap items-center gap-sm">
            <Badge tone={STAGE_META[lead.stage].tone} dot>
              {stageLabel(lead.stage)}
            </Badge>
            {converted && (
              <span className="text-xs text-fg-subtle">
                Converted {new Date(lead.convertedAt!).toLocaleDateString()}
              </span>
            )}
          </div>
        )}

        <div className="grid gap-md sm:grid-cols-2">
          <Field label="First name" error={errors.firstName?.message} {...register("firstName")} />
          <Field label="Last name" error={errors.lastName?.message} {...register("lastName")} />
          <Field
            label="Job title"
            placeholder="VP Operations"
            error={errors.title?.message}
            {...register("title")}
          />
          <Field label="Email" type="email" error={errors.email?.message} {...register("email")} />
          <Field label="Phone" type="tel" error={errors.phone?.message} {...register("phone")} />
          <Field
            label="LinkedIn"
            placeholder="linkedin.com/in/…"
            error={errors.linkedinUrl?.message}
            {...register("linkedinUrl")}
          />
        </div>

        <AccountSelect error={errors.accountId?.message} {...register("accountId")} />
        <Field
          label="Company (if not listed above)"
          placeholder="Typed in now, linked to a company record later"
          error={errors.company?.message}
          {...register("company")}
        />

        <div className="grid gap-md sm:grid-cols-2">
          <SelectField label="Stage" error={errors.stage?.message} {...register("stage")}>
            {LEAD_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stageLabel(stage)}
              </option>
            ))}
          </SelectField>

          <Field
            label="Follow up on"
            type="date"
            error={errors.followUpAt?.message}
            {...register("followUpAt")}
          />

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

          <Field
            label="Estimated value"
            type="number"
            min={0}
            step="any"
            error={errors.value?.message}
            {...register("value", { valueAsNumber: true })}
          />
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

      {lead && (
        <div className="mt-lg">
          <Timeline scope={{ leadId: lead.id }} />
        </div>
      )}
    </Modal>
  );
}
