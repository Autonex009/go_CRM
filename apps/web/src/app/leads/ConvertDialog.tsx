import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AccountSelect } from "../accounts/AccountSelect";
import { DEAL_STAGES, stageLabel, normalizeDealStage } from "../deals/stages";
import { dealFormSchema, type DealFormValues } from "../deals/schemas";
import { ApiError } from "../lib/api";
import { zodResolver } from "../lib/zodResolver";
import { memberLabel, orgApi } from "../org/api";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Field,
  Icon,
  Modal,
  SelectField,
  TextareaField,
} from "../ui";
import { leadCompany, leadName, type ConvertInput, type Lead } from "./api";

interface ConvertDialogProps {
  lead: Lead;
  onClose: () => void;
  onSubmit: (input: ConvertInput) => Promise<unknown>;
}

/**
 * Lead → Deal conversion.
 * Replicates the full Deal form so all fields can be reviewed and edited,
 * while minimizing manual typing by pre-filling everything from the lead.
 */
export function ConvertDialog({ lead, onClose, onSubmit }: ConvertDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const members = useQuery({
    queryKey: ["members"],
    queryFn: orgApi.members,
    staleTime: 5 * 60_000,
  });

  const defaultTitle = leadCompany(lead) || leadName(lead);

  // Pre-fill expected close: followUpAt date if present, or +14 days from today
  const defaultCloseDate = lead.followUpAt
    ? lead.followUpAt.slice(0, 10)
    : new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DealFormValues>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      title: defaultTitle,
      description: lead.notes ?? "",
      amount: lead.value ?? 0,
      stage: "discovery",
      ownerUserId: lead.ownerUserId ?? "",
      contactId: lead.contactId ?? "",
      expectedCloseDate: defaultCloseDate,
      accountId: lead.accountId ?? "",
      leadId: lead.id,
      totalCameras: null,
      location: "",
      products: lead.title ?? "",
    },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit({
        title: values.title.trim(),
        dealTitle: values.title.trim(),
        amount: values.amount,
        stage: normalizeDealStage(values.stage),
        dealStage: normalizeDealStage(values.stage),
        ownerUserId: values.ownerUserId?.trim() || undefined,
        accountId: values.accountId?.trim() || undefined,
        expectedCloseDate: values.expectedCloseDate?.trim()
          ? `${values.expectedCloseDate.trim()}T00:00:00Z`
          : undefined,
        totalCameras: values.totalCameras,
        location: values.location?.trim() || undefined,
        products: values.products?.trim() || undefined,
        description: values.description?.trim() || undefined,
        callNotes: values.description?.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Could not convert this lead",
      );
    }
  });

  return (
    <Modal title="Convert to deal" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-md" noValidate>
        {formError && <Alert>{formError}</Alert>}

        <p className="flex items-start gap-sm rounded-md bg-ok-soft px-md py-sm text-sm text-ok-fg">
          <Icon name="check" size={15} className="mt-[2px] shrink-0" />
          <span>
            This lead will be marked <strong>Converted</strong> and a new Deal
            record created automatically.
          </span>
        </p>

        {/* Pre-filled from lead indicator banner */}
        <section className="flex flex-col gap-xs">
          <h3 className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
            Pre-filled from lead
          </h3>
          <div className="flex items-center justify-between rounded-md border border-line bg-surface-muted px-md py-sm">
            <div className="flex items-center gap-sm min-w-0">
              <Avatar name={leadName(lead)} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">
                  {leadName(lead)}
                  {leadCompany(lead) ? ` — ${leadCompany(lead)}` : ""}
                </p>
                {lead.title && (
                  <p className="truncate text-xs text-fg-muted">{lead.title}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-xs shrink-0">
              {lead.source && <Badge tone="neutral">{lead.source}</Badge>}
            </div>
          </div>
        </section>

        <Field
          label="Title"
          error={errors.title?.message}
          {...register("title")}
        />

        <div className="grid gap-md sm:grid-cols-2">
          <Field
            label="Products"
            placeholder="VIGIL Pro; ANPR add-on"
            error={errors.products?.message}
            {...register("products")}
          />
          <Field
            label="No. of cameras"
            type="number"
            min={0}
            step={1}
            placeholder="24"
            error={errors.totalCameras?.message}
            {...register("totalCameras", { valueAsNumber: true })}
          />
        </div>

        <Field
          label="Location"
          placeholder="Pune (Plant 1); Nashik"
          error={errors.location?.message}
          {...register("location")}
        />

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
            label="Next follow up date"
            type="date"
            error={errors.expectedCloseDate?.message}
            {...register("expectedCloseDate")}
          />

          <SelectField
            label="Stage"
            error={errors.stage?.message}
            {...register("stage")}
          >
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

        <AccountSelect
          error={errors.accountId?.message}
          {...register("accountId")}
        />

        <TextareaField
          label="Description / Notes"
          rows={3}
          placeholder="Key notes, scope, next steps…"
          error={errors.description?.message}
          {...register("description")}
        />

        <div className="flex justify-end gap-sm mt-xs">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create deal"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
