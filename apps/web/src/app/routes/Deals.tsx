import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { DealCard } from "../deals/DealCard";
import { DealDialog } from "../deals/DealDialog";
import { dealsApi, type Deal, type DealInput } from "../deals/api";
import { DEAL_COLUMNS, type DealStage } from "../deals/stages";
import { formatMoneyCompact } from "../lib/money";
import { useCurrency } from "../org/workspace";
import { ApiError } from "../lib/api";
import { Alert, BoardSkeleton, Button, KanbanBoard, PageHeader } from "../ui";

/**
 * The deals pipeline. Same shared KanbanBoard as leads — only the columns, the
 * card and the mutations differ.
 */
export default function Deals() {
  const queryClient = useQueryClient();
  const currency = useCurrency();
  const query = useQuery({ queryKey: ["deals"], queryFn: dealsApi.board });

  const [moveError, setMoveError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ deal: Deal | null; stage: DealStage } | null>(null);

  const deals = query.data?.deals ?? [];

  const totals = useMemo(() => {
    let open = 0;
    let won = 0;
    for (const deal of deals) {
      if (deal.stage === "won") won += deal.amount;
      else if (deal.stage !== "lost") open += deal.amount;
    }
    return { count: deals.length, open, won };
  }, [deals]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["deals"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient]);

  const move = useMutation({
    mutationFn: ({ id, stage, index }: { id: string; stage: string; index: number }) =>
      dealsApi.move(id, stage as DealStage, index),
    onError: (err) => {
      setMoveError(err instanceof ApiError ? err.message : "Could not move that deal");
      // Local state and the server have diverged — the server wins.
      invalidate();
    },
    onSuccess: () => {
      setMoveError(null);
      invalidate();
    },
  });

  const save = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: DealInput }) =>
      id ? dealsApi.update(id, input) : dealsApi.create(input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => dealsApi.remove(id),
    onSuccess: invalidate,
  });

  // Stable callbacks, so the memoised board and cards aren't invalidated on
  // every parent render.
  const onMove = useCallback(
    (id: string, stage: string, index: number) => move.mutate({ id, stage, index }),
    [move],
  );
  const onOpen = useCallback((deal: Deal) => setDialog({ deal, stage: deal.stage }), []);
  const onAdd = useCallback(
    (stage: string) => setDialog({ deal: null, stage: stage as DealStage }),
    [],
  );
  const renderCard = useCallback(
    (deal: Deal, overlay: boolean) => <DealCard deal={deal} overlay={overlay} />,
    [],
  );
  const columnSummary = useCallback((items: Deal[]) => {
    const amount = items.reduce((sum, d) => sum + d.amount, 0);
    return amount > 0 ? formatMoneyCompact(amount, currency) : null;
  }, [currency]);

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader
        title="Deals"
        subtitle={
          query.isPending
            ? "Loading pipeline…"
            : `${totals.count} deal${totals.count === 1 ? "" : "s"} · ${formatMoneyCompact(
                totals.open,
                currency,
              )} open · ${formatMoneyCompact(totals.won, currency)} won`
        }
        action={
          <Button icon="plus" onClick={() => setDialog({ deal: null, stage: "prospect" })}>
            New deal
          </Button>
        }
      />

      {moveError && <Alert>{moveError}</Alert>}
      {query.isError && (
        <Alert>
          {query.error instanceof ApiError ? query.error.message : "Could not load the board"}
        </Alert>
      )}

      {query.isPending ? (
        <BoardSkeleton columns={DEAL_COLUMNS} />
      ) : (
        <KanbanBoard
          columns={DEAL_COLUMNS}
          items={deals}
          renderCard={renderCard}
          onMove={onMove}
          onOpen={onOpen}
          onAdd={onAdd}
          columnSummary={columnSummary}
          addLabel="Add deal"
        />
      )}

      {dialog && (
        <DealDialog
          deal={dialog.deal}
          defaultStage={dialog.stage}
          onClose={() => setDialog(null)}
          onSubmit={(input) => save.mutateAsync({ id: dialog.deal?.id, input })}
          onDelete={
            dialog.deal
              ? () => {
                  if (window.confirm("Delete this deal?")) {
                    remove.mutate(dialog.deal!.id);
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
