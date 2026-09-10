import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";


import { AccountDialog } from "../accounts/AccountDialog";
import {
  accountsApi,
  websiteLabel,
  PAGE_SIZE,
  type Account,
  type AccountFormValues,
} from "../accounts/api";
import { ApiError } from "../lib/api";
import { useDebounced } from "../lib/useDebounced";
import {
  Alert,
  Avatar,
  Button,
  Card,
  EmptyState,
  Icon,
  PageHeader,
  Skeleton,
} from "../ui";

/**
 * The confirmation shown before a company is deleted.
 *
 * Deleting one now takes its contacts, leads, deals, quotes and invoices with
 * it, so the prompt has to say so — the old "Delete X?" described a far smaller
 * action than the one it triggers.
 */
function confirmDeleteCompany(name: string): boolean {
  return window.confirm(
    `Delete ${name}?\n\nIts contacts, leads, deals, quotes and invoices are ` +
      `deleted with it, and its delivery tracker rows are removed permanently.`,
  );
}

export default function Accounts() {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialog, setDialog] = useState<{ account: Account | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.new) {
      setDialog({ account: null });
      // Clear state so it doesn't reopen on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Debounced so typing does not fire a request per keystroke; the input still
  // renders the raw value, so it never feels laggy.
  const search = useDebounced(searchQuery, 300);

  const query = useQuery({
    queryKey: ["accounts", offset, search],
    queryFn: () => accountsApi.list(offset, PAGE_SIZE, search),
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });

  const page = query.data;
  const total = page?.total ?? 0;
  const showing = page?.items.length ?? 0;

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    // Contact and deal dialogs list accounts in their pickers.
    void queryClient.invalidateQueries({ queryKey: ["accountOptions"] });
  }, [queryClient]);

  const save = useMutation({
    mutationFn: ({ id, values }: { id?: string; values: AccountFormValues }) =>
      id ? accountsApi.update(id, values) : accountsApi.create(values),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => accountsApi.remove(id),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => {
      // A 409 here means the account still has contacts or deals attached.
      setError(err instanceof ApiError ? err.message : "Could not delete that account");
    },
  });

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader
        title="Companies"
        subtitle={
          total === 0
            ? search
              ? `No companies match "${search}"`
              : "No companies yet"
            : `${total} compan${total === 1 ? "y" : "ies"}${
                search ? ` matching "${search}"` : ""
              }`
        }
        action={
          <div className="flex items-center gap-sm">
            <label className="relative">
              <span className="sr-only">Search companies</span>
              <Icon
                name="search"
                size={14}
                className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-fg-subtle"
              />
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  // A new term restarts paging, or page 3 of the old result set
                  // is requested against the new one.
                  setOffset(0);
                }}
                placeholder="Search name, website, industry…"
                className="h-[34px] w-[240px] rounded-lg border border-line bg-surface pl-[30px] pr-sm text-sm text-fg outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <Button icon="plus" onClick={() => setDialog({ account: null })}>
              New company
            </Button>
          </div>
        }
      />

      {error && <Alert>{error}</Alert>}
      {query.isError && (
        <Alert>
          {query.error instanceof ApiError ? query.error.message : "Could not load accounts"}
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
          icon="building"
          title="No accounts yet"
          description="Accounts are the companies behind your contacts and deals."
          hints={["Leads per company", "Linked contacts", "Deal history"]}
          action={
            <Button icon="plus" size="sm" onClick={() => setDialog({ account: null })}>
              New account
            </Button>
          }
        />
      ) : (
        /* A grid of cards rather than a table: a company is identified by its
           name and sized by what hangs off it, and those counts read as figures
           on a card far faster than as badges in a "Linked" column. */
        <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-3">
          {page!.items.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={() => setDialog({ account })}
              onDelete={() => {
                if (confirmDeleteCompany(account.name)) {
                  remove.mutate(account.id);
                }
              }}
              disabled={remove.isPending}
            />
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <nav className="flex items-center justify-between">
          <span className="text-xs tabular-nums text-fg-muted">
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

      {dialog && (
        <AccountDialog
          account={dialog.account}
          onClose={() => setDialog(null)}
          onSubmit={(values) => save.mutateAsync({ id: dialog.account?.id, values })}
          onDelete={
            dialog.account
              ? () => {
                  if (confirmDeleteCompany(dialog.account!.name)) {
                    remove.mutate(dialog.account!.id);
                    setDialog(null);
                  }
                }
              : undefined
          }
        />
      )}
    </section>
  );
}

/**
 * One company.
 *
 * The three counts are the point of this page — they are what tells you whether
 * a company is real work or an empty record — so they get their own row of
 * figures rather than being tucked into a badge list.
 */
function AccountCard({
  account,
  onEdit,
  onDelete,
  disabled,
}: {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const site = websiteLabel(account.website);
  const owner = account.ownerName?.trim() || account.ownerEmail;

  return (
    <Card
      padded={false}
      className="group flex flex-col overflow-hidden transition-all duration-150 hover:border-brand/40 hover:shadow-md"
    >
      <div className="flex items-start gap-sm p-md">
        <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Icon name="building" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to={`/accounts/${account.id}`}
            className="block truncate font-semibold text-fg transition-colors hover:text-brand"
            title={account.name}
          >
            {account.name}
          </Link>
          <span className="mt-[2px] block truncate text-xs text-fg-muted">
            {site ?? account.industry ?? "—"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px border-y border-line bg-line">
        <Stat label="Leads" value={account.leadCount} />
        <Stat label="Deals" value={account.dealCount} />
        <Stat label="Contacts" value={account.contactCount} />
      </div>

      <div className="flex items-center justify-between gap-sm p-md">
        {owner ? (
          <span className="flex min-w-0 items-center gap-xs">
            <Avatar name={owner} title={account.ownerEmail ?? owner} size="xs" />
            <span className="truncate text-xs text-fg-muted">{owner}</span>
          </span>
        ) : (
          <span className="text-xs text-fg-subtle">Unassigned</span>
        )}

        {/* Revealed on hover, but always reachable by keyboard — a control that
            only exists once the pointer is over it is a control nobody can tab
            to. */}
        <span className="flex shrink-0 items-center gap-xs opacity-0 transition-opacity duration-100 focus-within:opacity-100 group-hover:opacity-100">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={disabled}>
            <span className="text-bad-fg">Delete</span>
          </Button>
        </span>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface px-sm py-sm text-center">
      <span
        className={`block text-base font-bold tabular-nums ${
          value > 0 ? "text-fg" : "text-fg-subtle"
        }`}
      >
        {value}
      </span>
      <span className="block text-[11px] uppercase tracking-wide text-fg-muted">
        {label}
      </span>
    </div>
  );
}
