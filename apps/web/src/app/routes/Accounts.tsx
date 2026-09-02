import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";


import { AccountDialog } from "../accounts/AccountDialog";
import {
  accountsApi,
  websiteLabel,
  PAGE_SIZE,
  type Account,
  type AccountFormValues,
} from "../accounts/api";
import { ApiError } from "../lib/api";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  PageHeader,
  Skeleton,
} from "../ui";

export default function Accounts() {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [dialog, setDialog] = useState<{ account: Account | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["accounts", offset],
    queryFn: () => accountsApi.list(offset),
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
        title="Accounts"
        subtitle={
          total === 0 ? "No companies yet" : `${total} compan${total === 1 ? "y" : "ies"}`
        }
        action={
          <Button icon="plus" onClick={() => setDialog({ account: null })}>
            New account
          </Button>
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
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-muted text-xs uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-lg py-sm font-medium">Company</th>
                  <th className="px-lg py-sm font-medium">Owner</th>
                  <th className="px-lg py-sm font-medium">Linked</th>
                  <th className="px-lg py-sm" />
                </tr>
              </thead>
              <tbody>
                {page!.items.map((account) => (
                  <Row
                    key={account.id}
                    account={account}
                    onEdit={() => setDialog({ account })}
                    onDelete={() => {
                      if (window.confirm(`Delete ${account.name}?`)) {
                        remove.mutate(account.id);
                      }
                    }}
                    disabled={remove.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
                  if (window.confirm(`Delete ${dialog.account!.name}?`)) {
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

function Row({
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
    <tr className="border-b border-line transition-colors duration-100 last:border-0 hover:bg-surface-hover">
      <td className="px-lg py-sm">
        <Link to={`/accounts/${account.id}`} className="flex items-center gap-sm text-left group">
          <span className="flex h-[32px] w-[32px] items-center justify-center rounded-md bg-surface-muted text-fg-muted group-hover:bg-brand/10 group-hover:text-brand transition-colors">
            <Icon name="building" size={16} />
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-fg group-hover:text-brand transition-colors">{account.name}</span>
            <span className="block text-xs text-fg-muted">
              {site ?? account.industry ?? "—"}
            </span>
          </span>
        </Link>
      </td>

      <td className="px-lg py-sm">
        {owner ? (
          <span className="flex items-center gap-sm">
            <Avatar name={owner} title={account.ownerEmail ?? owner} size="xs" />
            <span className="text-fg-muted">{owner}</span>
          </span>
        ) : (
          <span className="text-fg-subtle">Unassigned</span>
        )}
      </td>
      <td className="px-lg py-sm">
        <span className="flex flex-wrap gap-xs">
          {account.contactCount > 0 && <Badge tone="brand">{account.contactCount} contacts</Badge>}
          {account.dealCount > 0 && <Badge tone="success">{account.dealCount} deals</Badge>}
          {account.contactCount === 0 && account.dealCount === 0 && (
            <span className="text-fg-subtle">—</span>
          )}
        </span>
      </td>
      <td className="px-lg py-sm text-right">
        <Button variant="ghost" size="sm" onClick={onDelete} disabled={disabled}>
          <span className="text-bad-fg">Delete</span>
        </Button>
      </td>
    </tr>
  );
}
