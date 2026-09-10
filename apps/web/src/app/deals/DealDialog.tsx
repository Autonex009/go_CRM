import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { AccountSelect } from "../accounts/AccountSelect";
import { leadsApi } from "../leads/api";
import { Timeline } from "../activities/Timeline";

import { ApiError } from "../lib/api";
import { zodResolver } from "../lib/zodResolver";
import { memberLabel, orgApi } from "../org/api";
import {
  Alert,
  Badge,
  Button,
  Field,
  Modal,
  SelectField,
  TextareaField,
} from "../ui";
import type { Deal, DealInput } from "./api";
import { buildQuoteStateFromDeal } from "./quote-utils";
import { dealFormSchema, toPayload, type DealFormValues } from "./schemas";
import {
  DEAL_STAGES,
  stageLabel,
  getStageMeta,
  normalizeDealStage,
  type DealStage,
} from "./stages";

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
export function DealDialog({
  deal,
  defaultStage,
  onClose,
  onSubmit,
  onDelete,
}: DealDialogProps) {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  // Both pickers reuse queries the rest of the app already caches.
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
  } = useForm<DealFormValues>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      title: deal?.title ?? "",
      description: deal?.description ?? "",
      amount: deal?.amount ?? 0,
      stage: normalizeDealStage(deal?.stage ?? defaultStage),
      ownerUserId: deal?.ownerUserId ?? "",
      contactId: deal?.contactId ?? "",
      // A native date input needs exactly YYYY-MM-DD.
      expectedCloseDate: deal?.expectedCloseDate?.slice(0, 10) ?? "",
      accountId: deal?.accountId ?? "",
      leadId: deal?.leadId ?? "",
      totalCameras: deal?.totalCameras ?? null,
      location: deal?.location ?? "",
      products: deal?.products ?? "",
    },
  });

  const accountId = useWatch({
    control,
    name: "accountId",
  });

  // The picker asks the server for the leads it needs rather than paging through
  // them here. Once a company is chosen it fetches that company's leads — all of
  // them, since the largest companies carry more than the old fixed first-100
  // this used to filter client-side, which is why a big company's leads went
  // missing from the dropdown. With no company chosen yet it takes the same page
  // across the workspace to browse.
  const allLeads = useQuery({
    queryKey: ["leads", "picker", accountId ?? ""],
    queryFn: () => leadsApi.list(0, "", 500, accountId ? { accountId } : {}),
    staleTime: 60_000,
  });

  const leadId = useWatch({ control, name: "leadId" });

  useEffect(() => {
    if (leadId && allLeads.data) {
      const selectedLead = allLeads.data.items.find((l) => l.id === leadId);
      if (selectedLead) {
        if (selectedLead.accountId)
          setValue("accountId", selectedLead.accountId);
        if (selectedLead.contactId)
          setValue("contactId", selectedLead.contactId);
        if (selectedLead.ownerUserId)
          setValue("ownerUserId", selectedLead.ownerUserId);
        if (selectedLead.value) setValue("amount", selectedLead.value);
        // The deal title is the deal's own name, not the lead's. Pre-fill from the
        // lead's company (what the deal is actually about) and only when the user
        // has not typed one; falling back to the person's name produced titles
        // like "Chandan  - Deal".
        if (!deal?.title) {
          const company = selectedLead.company?.trim();
          if (company) setValue("title", company, { shouldValidate: true });
        }
      }
    }
  }, [leadId, allLeads.data, setValue, deal]);

  /**
   * Leads the selected account can actually be linked to.
   *
   * The server rejects a lead filed under a different account, so offering the
   * whole workspace here would just be a way to fail on save. The query above
   * already scopes this to the chosen company, so there is nothing left to
   * filter — the guard below only keeps a lead the fetch has not returned yet
   * from being silently cleared.
   */
  const selectableLeads = allLeads.data?.items ?? [];

  // Switching account used to leave a now-invalid lead selected, and the save
  // failed with a message about an account the user had already moved on from.
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
      setFormError(
        err instanceof ApiError ? err.message : "Could not save this deal",
      );
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
            <Badge tone={getStageMeta(deal.stage).tone} dot>
              {stageLabel(deal.stage)}
            </Badge>
            <span className="text-xs text-fg-subtle">
              Created {new Date(deal.createdAt).toLocaleDateString()}
            </span>
          </div>
        )}

        <Field
          label="Title"
          error={errors.title?.message}
          {...register("title")}
        />

        <div className="grid gap-md sm:grid-cols-3">
          <Field
            label="Total cameras"
            type="number"
            min={0}
            placeholder="e.g. 15"
            error={errors.totalCameras?.message}
            {...register("totalCameras", {
              setValueAs: (v) =>
                v === "" || v === null || Number.isNaN(Number(v))
                  ? null
                  : Number(v),
            })}
          />
          <Field
            label="Location"
            placeholder="e.g. Mumbai, Plant 2"
            error={errors.location?.message}
            {...register("location")}
          />
          <Field
            label="Products"
            placeholder="e.g. Safety AI, ANPR"
            error={errors.products?.message}
            {...register("products")}
          />
        </div>

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

        <div>
          <SelectField
            label="Lead"
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
          {accountId && selectableLeads.length === 0 && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
              No leads found connected to this company.
            </p>
          )}
        </div>

        <TextareaField
          label="Description"
          rows={3}
          error={errors.description?.message}
          {...register("description")}
        />

        {/* Existing deals carry a history; a new one has nothing to show yet.
            Collapsible here because the timeline sits between the fields and the
            Save button — on a deal with a long history, Save ends up off the
            bottom of the dialog. */}
        {deal && <Timeline scope={{ dealId: deal.id }} collapsible />}

        <div className="flex justify-end gap-sm">
          {deal && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                navigate("/quotes/new", {
                  state: buildQuoteStateFromDeal(deal),
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
