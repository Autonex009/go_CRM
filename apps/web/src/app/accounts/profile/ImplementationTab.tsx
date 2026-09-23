import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AskCard } from "../../implementation/AskCard";
import { AskDialog } from "../../implementation/AskDialog";
import {
  implementationApi,
  type Ask,
  type AskInput,
  type AskStatus,
} from "../../implementation/api";
import { STATUS_META } from "../../implementation/meta";
import { ApiError } from "../../lib/api";
import { Alert, Badge, Card, CardHeader, EmptyState, Skeleton } from "../../ui";

/**
 * The company profile's implementation tab: every ask raised against this
 * company's deals and leads, in one list.
 */
export function ImplementationTab({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<Ask | null>(null);

  const query = useQuery({
    queryKey: ["implementation", { accountId }],
    queryFn: () => implementationApi.board({ accountId }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["implementation"] });
    void queryClient.invalidateQueries({ queryKey: ["dealAsks"] });
  };

  const save = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AskInput }) =>
      implementationApi.update(id, input),
    onSuccess: invalidate,
  });

  const move = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: AskStatus; reason: string }) =>
      implementationApi.move(id, status, reason),
    onSuccess: invalidate,
  });

  if (query.isPending) return <Skeleton className="h-40 w-full" />;

  if (query.isError) {
    return (
      <Alert>
        {query.error instanceof ApiError
          ? query.error.message
          : "Could not load implementation asks"}
      </Alert>
    );
  }

  const asks = query.data?.asks ?? [];

  return (
    <Card className="flex flex-col gap-md">
      <CardHeader
        title="Implementation"
        subtitle="Engineering asks raised against this company."
      />

      {asks.length === 0 ? (
        <EmptyState
          icon="check"
          size="sm"
          title="No asks yet"
          description="Raise one from a deal card and it will show up here."
        />
      ) : (
        <ul className="grid gap-sm sm:grid-cols-2">
          {asks.map((ask) => (
            <li key={ask.id}>
              <button
                type="button"
                onClick={() => setDialog(ask)}
                className="w-full text-left"
              >
                <AskCard ask={ask} />
                <span className="mt-1 block">
                  <Badge tone={STATUS_META[ask.status].tone}>
                    {STATUS_META[ask.status].label}
                  </Badge>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {dialog && (
        <AskDialog
          ask={dialog}
          parent={{
            dealId: dialog.dealId ?? undefined,
            leadId: dialog.leadId ?? undefined,
            company: dialog.accountName ?? "",
            label: [dialog.accountName, dialog.dealTitle ?? dialog.leadTitle]
              .filter(Boolean)
              .join(" — "),
          }}
          onClose={() => setDialog(null)}
          onSubmit={(input) => save.mutateAsync({ id: dialog.id, input })}
          onStatusChange={async (status, reason) => {
            await move.mutateAsync({ id: dialog.id, status, reason });
            setDialog(null);
          }}
        />
      )}
    </Card>
  );
}
