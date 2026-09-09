import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { DealCard } from "../deals/DealCard";
import { TrackerTable } from "../delivery/TrackerTable";
import { DealDialog } from "../deals/DealDialog";
import { RemarkDialog } from "../deals/RemarkDialog";
import { dealsApi, type Deal, type DealInput } from "../deals/api";
import { buildQuoteStateFromDeal } from "../deals/quote-utils";
import { DEAL_COLUMNS, type DealStage } from "../deals/stages";
import { formatMoneyCompact } from "../lib/money";
import { useCurrency } from "../org/workspace";
import { ApiError } from "../lib/api";
import { Alert, BoardSkeleton, Button, Icon, KanbanBoard, PageHeader } from "../ui";

/**
 * Whether the board is collapsed, remembered per browser.
 *
 * A viewer preference, not shared state: someone who works out of the tracker
 * wants the board out of the way every time they open the page, and someone
 * else on the same team does not.
 */
const BOARD_COLLAPSED_KEY = "gocrm.deals.boardCollapsed";

function readCollapsed(): boolean {
  // Wrapped because storage throws outright in some privacy modes, and during
  // SSR there is no localStorage at all.
  try {
    return localStorage.getItem(BOARD_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

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
  const [remarkDeal, setRemarkDeal] = useState<Deal | null>(null);
  const [boardCollapsed, setBoardCollapsed] = useState(readCollapsed);

  const toggleBoard = useCallback(() => {
    setBoardCollapsed((collapsed) => {
      const next = !collapsed;
      try {
        localStorage.setItem(BOARD_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // A preference that cannot be remembered still works for this visit.
      }
      return next;
    });
  }, []);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.new) {
      setDialog({ deal: null, stage: "discovery" });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

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
  const onRemark = useCallback((deal: Deal) => setRemarkDeal(deal), []);
  const onGenerateQuote = useCallback(
    (deal: Deal) => {
      navigate("/quotes/new", {
        state: buildQuoteStateFromDeal(deal),
      });
    },
    [navigate],
  );
  const renderCard = useCallback(
    (deal: Deal, overlay: boolean) => (
      <DealCard
        deal={deal}
        overlay={overlay}
        onRemark={onRemark}
        onGenerateQuote={onGenerateQuote}
      />
    ),
    [onRemark, onGenerateQuote],
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
          <Button icon="plus" onClick={() => setDialog({ deal: null, stage: "discovery" })}>
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

      <div className="flex flex-col gap-sm">
        <button
          type="button"
          onClick={toggleBoard}
          aria-expanded={!boardCollapsed}
          aria-controls="deals-board"
          className="flex w-fit items-center gap-xs rounded-md px-xs py-[2px] text-xs font-semibold uppercase tracking-wide text-fg-muted transition-colors duration-100 hover:bg-surface-hover hover:text-fg"
        >
          <Icon
            name="chevronLeft"
            size={14}
            className={`transition-transform duration-150 ${boardCollapsed ? "-rotate-90" : "rotate-90"}`}
          />
          Pipeline
          {boardCollapsed && (
            <span className="font-normal normal-case tracking-normal text-fg-subtle">
              ({totals.count} hidden)
            </span>
          )}
        </button>

        {/* Unmounted rather than hidden while collapsed: the board holds drag
            sensors and a card per deal, and none of that should keep running
            behind a table someone is typing into. */}
        {!boardCollapsed &&
          (query.isPending ? (
            <BoardSkeleton columns={DEAL_COLUMNS} />
          ) : (
            <div id="deals-board">
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
            </div>
          ))}
      </div>

      <TrackerTable />

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

      {remarkDeal && (
        <RemarkDialog
          deal={remarkDeal}
          onClose={() => setRemarkDeal(null)}
          onSubmit={(input) => save.mutateAsync({ id: remarkDeal.id, input })}
        />
      )}
    </section>
  );
}
