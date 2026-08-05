import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";

import { contactName, contactsApi, PAGE_SIZE, type Contact } from "../contacts/api";
import { newContactSchema, type NewContactInput } from "../contacts/schemas";
import { ApiError } from "../lib/api";
import { zodResolver } from "../lib/zodResolver";
import {
  Alert,
  Avatar,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Skeleton,
} from "../ui";

export default function Contacts() {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: ["contacts", offset],
    queryFn: () => contactsApi.list(offset),
    // Keep the current page on screen while the next one loads, instead of
    // collapsing the table back to a skeleton on every page change.
    placeholderData: keepPreviousData,
  });

  const page = query.data;
  const total = page?.total ?? 0;
  const showing = page?.items.length ?? 0;

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["contacts"] }),
    [queryClient],
  );

  const remove = useMutation({
    mutationFn: (id: string) => contactsApi.remove(id),
    onSuccess: invalidate,
  });

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader
        title="Contacts"
        subtitle={total === 0 ? "No contacts yet" : `${total} contact${total === 1 ? "" : "s"}`}
        action={
          <Button icon="plus" onClick={() => setCreating(true)}>
            New contact
          </Button>
        }
      />

      {query.isError && (
        <Alert>
          {query.error instanceof ApiError ? query.error.message : "Could not load contacts"}
        </Alert>
      )}

      {query.isPending ? (
        <Card padded={false} className="p-md">
          <div className="flex flex-col gap-sm">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[44px] w-full" />
            ))}
          </div>
        </Card>
      ) : showing === 0 ? (
        <EmptyState
          icon="contacts"
          title="No contacts yet"
          description="Contacts are the people behind your deals. Add one to get started."
          action={
            <Button icon="plus" size="sm" onClick={() => setCreating(true)}>
              New contact
            </Button>
          }
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-lg py-sm font-medium">Name</th>
                  <th className="px-lg py-sm font-medium">Email</th>
                  <th className="px-lg py-sm font-medium">Phone</th>
                  <th className="px-lg py-sm" />
                </tr>
              </thead>
              <tbody>
                {page!.items.map((contact) => (
                  <Row
                    key={contact.id}
                    contact={contact}
                    disabled={remove.isPending}
                    onDelete={() => {
                      if (window.confirm(`Delete ${contactName(contact)}?`)) {
                        remove.mutate(contact.id);
                      }
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {total > PAGE_SIZE && (
        <nav className="flex items-center justify-between text-sm">
          <span className="text-xs text-fg-muted tabular-nums">
            {offset + 1}–{offset + showing} of {total}
          </span>
          <div className="flex gap-sm">
            <Button
              variant="secondary"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={offset + showing >= total}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </nav>
      )}

      {creating && <NewContactDialog onClose={() => setCreating(false)} onSaved={invalidate} />}
    </section>
  );
}

function Row({
  contact,
  onDelete,
  disabled,
}: {
  contact: Contact;
  onDelete: () => void;
  disabled: boolean;
}) {
  const name = contactName(contact);
  return (
    <tr className="border-b border-line transition-colors duration-100 last:border-0 hover:bg-surface-hover">
      <td className="px-lg py-sm">
        <span className="flex items-center gap-sm">
          <Avatar name={name} size="xs" />
          <span className="font-medium text-fg">{name}</span>
        </span>
      </td>
      <td className="px-lg py-sm text-fg-muted">{contact.email ?? "—"}</td>
      <td className="px-lg py-sm text-fg-muted">{contact.phone ?? "—"}</td>
      <td className="px-lg py-sm text-right">
        <Button variant="ghost" size="sm" onClick={onDelete} disabled={disabled}>
          <span className="text-bad-fg">Delete</span>
        </Button>
      </td>
    </tr>
  );
}

function NewContactDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewContactInput>({ resolver: zodResolver(newContactSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await contactsApi.create(values);
      onSaved();
      onClose();
    } catch (err) {
      // 409 (duplicate email) and 400 (validation) arrive with the gateway's own
      // message; show it rather than a generic failure.
      setFormError(err instanceof ApiError ? err.message : "Could not save contact");
    }
  });

  return (
    <Modal title="New contact" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-md" noValidate>
        {formError && <Alert>{formError}</Alert>}

        <div className="grid gap-md sm:grid-cols-2">
          <Field
            label="First name"
            autoComplete="given-name"
            error={errors.firstName?.message}
            {...register("firstName")}
          />
          <Field
            label="Last name"
            autoComplete="family-name"
            error={errors.lastName?.message}
            {...register("lastName")}
          />
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Field
            label="Phone"
            type="tel"
            autoComplete="tel"
            error={errors.phone?.message}
            {...register("phone")}
          />
        </div>

        <div className="flex justify-end gap-sm">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save contact"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
