import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { ApiError } from "../lib/api";
import { zodResolver } from "../lib/zodResolver";
import { memberLabel, orgApi } from "../org/api";
import { Alert, Badge, Button, Field, Modal, SelectField, TextareaField } from "../ui";
import type { Account, AccountFormValues } from "./api";
import { accountFormSchema } from "./api";

interface AccountDialogProps {
  /** Existing account to edit, or null to create. */
  account: Account | null;
  onClose: () => void;
  onSubmit: (values: AccountFormValues) => Promise<unknown>;
  onDelete?: () => void;
}

/** Create/edit form. One dialog for both, since the field set is identical. */
export function AccountDialog({ account, onClose, onSubmit, onDelete }: AccountDialogProps) {
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
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: account?.name ?? "",
      website: account?.website ?? "",
      industry: account?.industry ?? "",
      phone: account?.phone ?? "",
      notes: account?.notes ?? "",
      ownerUserId: account?.ownerUserId ?? "",
    },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save this account");
    }
  });

  const linked = (account?.contactCount ?? 0) + (account?.dealCount ?? 0);

  return (
    <Modal
      title={account ? "Edit account" : "New account"}
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

        {account && linked > 0 && (
          <div className="flex flex-wrap items-center gap-sm">
            {account.contactCount > 0 && (
              <Badge tone="brand">
                {account.contactCount} contact{account.contactCount === 1 ? "" : "s"}
              </Badge>
            )}
            {account.dealCount > 0 && (
              <Badge tone="success">
                {account.dealCount} deal{account.dealCount === 1 ? "" : "s"}
              </Badge>
            )}
            <span className="text-xs text-fg-subtle">must be unlinked before deleting</span>
          </div>
        )}

        <Field label="Company name" error={errors.name?.message} {...register("name")} />

        <div className="grid gap-md sm:grid-cols-2">
          <Field
            label="Website"
            placeholder="acme.com"
            error={errors.website?.message}
            {...register("website")}
          />
          <Field label="Phone" type="tel" error={errors.phone?.message} {...register("phone")} />
          <Field label="Industry" error={errors.industry?.message} {...register("industry")} />

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

        <TextareaField
          label="Notes"
          rows={3}
          error={errors.notes?.message}
          {...register("notes")}
        />

        <div className="flex justify-end gap-sm">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : account ? "Save changes" : "Create account"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
