import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { LeadCard } from "../leads/LeadCard";
import { LeadDialog } from "../leads/LeadDialog";
import { leadsApi, type Lead, type LeadInput } from "../leads/api";
import { LEAD_COLUMNS, formatCompact, type LeadStage } from "../leads/stages";
import { ApiError } from "../lib/api";
import { Alert, BoardSkeleton, Button, KanbanBoard, PageHeader } from "../ui";

/**
 * The leads pipeline. All the drag mechanics live in the shared KanbanBoard;
 * this page supplies the columns, the card, and what a move means.
 */
export default function Leads() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["leads"], queryFn: leadsApi.board });

  const [moveError, setMoveError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ lead: Lead | null; stage: LeadStage } | null>(null);

  const leads = query.data?.leads ?? [];

  const totals = useMemo(() => {
    let open = 0;
    for (const lead of leads) {
      if (lead.stage !== "won" && lead.stage !== "lost") open += lead.value ?? 0;
    }
    return { count: leads.length, open };
  }, [leads]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient]);

  const move = useMutation({
    mutationFn: ({ id, stage, index }: { id: string; stage: string; index: number }) =>
      leadsApi.move(id, stage as LeadStage, index),
    onError: (err) => {
      setMoveError(err instanceof ApiError ? err.message : "Could not move that lead");
      // Local state and the server have diverged — the server wins.
      invalidate();
    },
    onSuccess: () => {
      setMoveError(null);
      invalidate();
    },
  });

  const save = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: LeadInput }) =>
      id ? leadsApi.update(id, input) : leadsApi.create(input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => leadsApi.remove(id),
    onSuccess: invalidate,
  });

  // Stable callbacks, so the memoised board and cards aren't invalidated on
  // every parent render.
  const onMove = useCallback(
    (id: string, stage: string, index: number) => move.mutate({ id, stage, index }),
    [move],
  );
  const onOpen = useCallback((lead: Lead) => setDialog({ lead, stage: lead.stage }), []);
  const onAdd = useCallback(
    (stage: string) => setDialog({ lead: null, stage: stage as LeadStage }),
    [],
  );
  const renderCard = useCallback(
    (lead: Lead, overlay: boolean) => <LeadCard lead={lead} overlay={overlay} />,
    [],
  );
  const columnSummary = useCallback((items: Lead[]) => {
    const value = items.reduce((sum, l) => sum + (l.value ?? 0), 0);
    return value > 0 ? formatCompact(value) : null;
  }, []);

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader
        title="Leads"
        subtitle={
          query.isPending
            ? "Loading pipeline…"
            : `${totals.count} in the pipeline · ${formatCompact(totals.open)} open value`
        }
        action={
          <Button icon="plus" onClick={() => setDialog({ lead: null, stage: "new" })}>
            New lead
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
        <BoardSkeleton columns={LEAD_COLUMNS} />
      ) : (
        <KanbanBoard
          columns={LEAD_COLUMNS}
          items={leads}
          renderCard={renderCard}
          onMove={onMove}
          onOpen={onOpen}
          onAdd={onAdd}
          columnSummary={columnSummary}
          addLabel="Add lead"
        />
      )}

      {dialog && (
        <LeadDialog
          lead={dialog.lead}
          defaultStage={dialog.stage}
          onClose={() => setDialog(null)}
          onSubmit={(input) => save.mutateAsync({ id: dialog.lead?.id, input })}
          onDelete={
            dialog.lead
              ? () => {
                  if (window.confirm("Delete this lead?")) {
                    remove.mutate(dialog.lead!.id);
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
