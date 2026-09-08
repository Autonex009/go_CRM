import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { accountsApi } from "../accounts/api";
import { AccountSelect } from "../accounts/AccountSelect";
import { leadsApi } from "../leads/api";
import { Timeline } from "../activities/Timeline";
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
  const navigate = useNavigate();
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
    control,
    setValue,
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
      leadId: "",
    },
  });

  const accountId = useWatch({
    control,
    name: "accountId",
  });

  const accountProfile = useQuery({
    queryKey: ["accountProfile", accountId],
    queryFn: () => accountsApi.getProfile(accountId as string),
    enabled: Boolean(accountId),
    staleTime: 60_000,
  });

  const allLeads = useQuery({
    queryKey: ["leads"],
    queryFn: () => leadsApi.list(),
    staleTime: 60_000,
  });

  const leadId = useWatch({ control, name: "leadId" });

  useEffect(() => {
    if (leadId && allLeads.data) {
      const selectedLead = allLeads.data.items.find((l) => l.id === leadId);
      if (selectedLead) {
        if (selectedLead.accountId) setValue("accountId", selectedLead.accountId);
        if (selectedLead.contactId) setValue("contactId", selectedLead.contactId);
        if (selectedLead.ownerUserId) setValue("ownerUserId", selectedLead.ownerUserId);
        if (selectedLead.value) setValue("amount", selectedLead.value);
        if (!deal?.title) setValue("title", `${selectedLead.firstName} ${selectedLead.lastName || ""} - Deal`);
      }
    }
  }, [leadId, allLeads.data, setValue, deal]);

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
        
        <SelectField label="Lead" error={errors.leadId?.message} {...register("leadId")}>
          <option value="">—</option>
          {(allLeads.data?.items ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.firstName} {l.lastName ?? ""} {l.title ? `(${l.title})` : ""}
            </option>
          ))}
        </SelectField>

        <TextareaField
          label="Description"
          rows={3}
          error={errors.description?.message}
          {...register("description")}
        />

        {/* Existing deals carry a history; a new one has nothing to show yet. */}
        {deal && <Timeline scope={{ dealId: deal.id }} />}

        <div className="flex justify-end gap-sm">
          {deal && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                navigate("/quotes/new", {
                  state: {
                    accountId: deal.accountId,
                    dealId: deal.id,
                    contactId: deal.contactId,
                    title: `${deal.title} - Quote`,
                  },
                });
                onClose();
              }}
            >
              Generate Quote
            </Button>
          )}
          <div className="flex-1" />
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
