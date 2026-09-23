import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { Deal } from "../deals/api";
import { ApiError } from "../lib/api";
import { Alert, Badge, Button, EmptyState, Skeleton } from "../ui";
import { AskCard } from "./AskCard";
import { AskDialog } from "./AskDialog";
import {
  implementationApi,
  type Ask,
  type AskInput,
  type AskStatus,
} from "./api";
import { STATUS_META } from "./meta";
import { useDeleteAsk } from "./useDeleteAsk";

/** One deal's implementation asks, inside its working view. */
export function DealImplementationPanel({ deal }: { deal: Deal }) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ ask: Ask | null } | null>(null);

  const query = useQuery({
    queryKey: ["implementation", { dealId: deal.id }],
    queryFn: () => implementationApi.board({ dealId: deal.id }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["implementation"] });
    void queryClient.invalidateQueries({ queryKey: ["dealAsks"] });
  };

  const save = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: AskInput }) =>
      id ? implementationApi.update(id, input) : implementationApi.create(input),
    onSuccess: invalidate,
  });

  const move = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: AskStatus; reason: string }) =>
      implementationApi.move(id, status, reason),
    onSuccess: invalidate,
  });

  const deleteAsk = useDeleteAsk((id) =>
    setDialog((d) => (d?.ask?.id === id ? null : d)),
  );

  const asks = query.data?.asks ?? [];

  const parent = {
    dealId: deal.id,
    company: deal.accountName ?? deal.title,
    label: [deal.accountName, deal.title, deal.products].filter(Boolean).join(" · "),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-end px-lg pb-sm">
        <Button size="sm" icon="plus" onClick={() => setDialog({ ask: null })}>
          New ask
        </Button>
      </div>

      <div className="px-lg pb-lg lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
        {query.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : query.isError ? (
          <Alert>
            {query.error instanceof ApiError
              ? query.error.message
              : "Could not load implementation asks"}
          </Alert>
        ) : asks.length === 0 ? (
          <EmptyState
            icon="check"
            size="sm"
            title="No tech asks yet"
            description="Raise one and the tech team sees it on their board."
            action={
              <Button size="sm" icon="plus" onClick={() => setDialog({ ask: null })}>
                New ask
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-sm">
            {asks.map((ask) => (
              <li key={ask.id}>
                {/* A div, not a button: the card carries its own delete button,
                    and buttons cannot nest. */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setDialog({ ask })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDialog({ ask });
                    }
                  }}
                  className="w-full cursor-pointer rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                >
                  <AskCard ask={ask} onDelete={deleteAsk} />
                  <span className="mt-1 block">
                    <Badge tone={STATUS_META[ask.status].tone}>
                      {STATUS_META[ask.status].label}
                    </Badge>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {dialog && (
        <AskDialog
          ask={dialog.ask}
          parent={parent}
          onClose={() => setDialog(null)}
          onSubmit={(input) => save.mutateAsync({ id: dialog.ask?.id, input })}
          onStatusChange={
            dialog.ask
              ? async (status, reason) => {
                  await move.mutateAsync({ id: dialog.ask!.id, status, reason });
                  setDialog(null);
                }
              : undefined
          }
          onDelete={dialog.ask ? () => deleteAsk(dialog.ask!) : undefined}
        />
      )}
    </div>
  );
}
