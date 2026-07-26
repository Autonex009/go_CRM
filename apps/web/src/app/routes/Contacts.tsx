import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert } from "../components/AuthLayout";
import { Field } from "../components/Field";
import { contactsApi, PAGE_SIZE, type Contact } from "../contacts/api";
import { newContactSchema, type NewContactInput } from "../contacts/schemas";
import { ApiError } from "../lib/api";
import { zodResolver } from "../lib/zodResolver";

export default function Contacts() {
  const [offset, setOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);

  const query = useQuery({
    queryKey: ["contacts", offset],
    queryFn: () => contactsApi.list(offset),
    // Keep the current page on screen while the next one loads, instead of
    // collapsing the table back to a spinner on every page change.
    placeholderData: keepPreviousData,
  });

  const page = query.data;
  const total = page?.total ?? 0;
  const showing = page?.items.length ?? 0;

  return (
    <section className="flex flex-col gap-lg">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Contacts</h1>
          <p className="mt-xs text-sm text-neutral-500">
            {total === 0 ? "No contacts yet" : `${total} contact${total === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-600 px-md py-sm text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          {showForm ? "Cancel" : "New contact"}
        </button>
      </header>

      {showForm && <NewContactForm onDone={() => setShowForm(false)} />}

      {query.isError && (
        <Alert>
          {query.error instanceof ApiError ? query.error.message : "Could not load contacts"}
        </Alert>
      )}

      {query.isPending ? (
        <p className="text-sm text-neutral-500">Loading contacts…</p>
      ) : (
        <ContactsTable contacts={page?.items ?? []} />
      )}

      {total > PAGE_SIZE && (
        <nav className="flex items-center justify-between text-sm">
          <span className="text-neutral-500">
            {offset + 1}–{offset + showing} of {total}
          </span>
          <div className="flex gap-sm">
            <PagerButton
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              Previous
            </PagerButton>
            <PagerButton
              disabled={offset + showing >= total}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Next
            </PagerButton>
          </div>
        </nav>
      )}
    </section>
  );
}

function ContactsTable({ contacts }: { contacts: Contact[] }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => contactsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contacts"] }),
  });

  if (contacts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-900/15 bg-white p-xl text-center">
        <p className="text-sm text-neutral-500">
          Your first contact will show up here once you add one.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-900/10 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-900/10 text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-md py-sm font-medium">Name</th>
            <th className="px-md py-sm font-medium">Email</th>
            <th className="px-md py-sm font-medium">Phone</th>
            <th className="px-md py-sm" />
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => (
            <tr key={c.id} className="border-b border-neutral-900/10 last:border-0">
              <td className="px-md py-sm font-medium text-neutral-900">
                {c.firstName} {c.lastName}
              </td>
              <td className="px-md py-sm text-neutral-500">{c.email}</td>
              <td className="px-md py-sm text-neutral-500">{c.phone ?? "—"}</td>
              <td className="px-md py-sm text-right">
                <button
                  onClick={() => {
                    if (window.confirm(`Delete ${c.firstName} ${c.lastName}?`)) {
                      remove.mutate(c.id);
                    }
                  }}
                  disabled={remove.isPending}
                  className="text-sm font-medium text-red-600 transition hover:text-red-700 disabled:opacity-60"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NewContactForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewContactInput>({ resolver: zodResolver(newContactSchema) });

  const create = useMutation({
    mutationFn: (input: NewContactInput) => contactsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      reset();
      onDone();
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await create.mutateAsync(values);
    } catch (err) {
      // 409 (duplicate email) and 400 (validation) arrive with the gateway's
      // own message; show it rather than a generic failure.
      setFormError(err instanceof ApiError ? err.message : "Could not save contact");
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-md rounded-lg border border-neutral-900/10 bg-white p-lg"
      noValidate
    >
      <h2 className="text-sm font-semibold text-neutral-900">New contact</h2>
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
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-neutral-900/15 px-md py-sm text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-brand-600 px-md py-sm text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {isSubmitting ? "Saving…" : "Save contact"}
        </button>
      </div>
    </form>
  );
}

function PagerButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-md border border-neutral-900/15 px-md py-xs font-medium text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
