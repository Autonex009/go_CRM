import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { DealCard } from "../deals/DealCard";
import { TrackerTable } from "../delivery/TrackerTable";
import { DealDialog } from "../deals/DealDialog";
import { DealWorkDialog } from "../deals/DealWorkDialog";
import { dealsApi, type Deal, type DealInput } from "../deals/api";
import { dealTasksApi, type DealTask } from "../deals/tasks";
import { actionsApi, type Action } from "../actions/api";
import { MANAGER_ROLES } from "../auth/roles";
import { useAuthStore } from "../auth/store";
import { memberLabel, orgApi } from "../org/api";
import { buildQuoteStateFromDeal } from "../deals/quote-utils";
import { DEAL_COLUMNS, type DealStage } from "../deals/stages";
import { formatMoneyCompact } from "../lib/money";
import { useCurrency } from "../org/workspace";
import { ApiError } from "../lib/api";
import {
  Alert,
  BoardSkeleton,
  Button,
  Icon,
  KanbanBoard,
  PageHeader,
} from "../ui";

/**
 * Whether the board is collapsed, remembered per browser.
 *
 * A viewer preference, not shared state: someone who works out of the tracker
 * wants the board out of the way every time they open the page, and someone
 * else on the same team does not.
 */
const BOARD_COLLAPSED_KEY = "gocrm.deals.boardCollapsed";

/** Board sort orders. "default" keeps each column's own stored order. */
type SortKey = "default" | "amountDesc" | "amountAsc" | "closeSoon" | "recent";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "default", label: "Default order" },
  { key: "amountDesc", label: "Value: high to low" },
  { key: "amountAsc", label: "Value: low to high" },
  { key: "closeSoon", label: "Closing soonest" },
  { key: "recent", label: "Recently updated" },
];

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

  // Actions are manager-only server-side, so reps never see the card's Actions
  // view and never fire this request.
  const userRole = useAuthStore((s) => s.user?.role);
  const canSeeActions = !!userRole && MANAGER_ROLES.includes(userRole);

  // One org-wide fetch for the whole board, sharing the Actions dashboard's
  // cache key — the cards are views onto the same data, not separate copies.
  const actionsQuery = useQuery({
    queryKey: ["actions", {}],
    queryFn: () => actionsApi.list({}),
    staleTime: 60_000,
    enabled: canSeeActions,
  });

  // Tasks are rep-facing, so unlike actions this loads for everyone. One
  // request for the whole board, grouped per card below.
  const tasksQuery = useQuery({
    queryKey: ["dealTasks"],
    queryFn: () => dealTasksApi.list(),
    staleTime: 60_000,
  });

  const tasksByDeal = useMemo(() => {
    const map = new Map<string, DealTask[]>();
    for (const task of tasksQuery.data ?? []) {
      const list = map.get(task.dealId);
      if (list) list.push(task);
      else map.set(task.dealId, [task]);
    }
    return map;
  }, [tasksQuery.data]);

  const members = useQuery({
    queryKey: ["members"],
    queryFn: orgApi.members,
    staleTime: 5 * 60_000,
  });

  const actionsByDeal = useMemo(() => {
    const map = new Map<string, Action[]>();
    const actions = actionsQuery.data ?? [];
    for (const action of actions) {
      if (!action.dealId) continue;
      const list = map.get(action.dealId);
      if (list) list.push(action);
      else map.set(action.dealId, [action]);
    }
    return map;
  }, [actionsQuery.data]);

  const memberName = useCallback(
    (id: string | null) => {
      if (!id) return "Unassigned";
      const m = (members.data ?? []).find((x) => x.id === id);
      return m ? memberLabel(m) : "—";
    },
    [members.data],
  );

  const [moveError, setMoveError] = useState<string | null>(null);
  // Failures from the dialog's own actions (delete today), shown on the page
  // rather than inside the dialog: the dialog closes on success, so an error
  // that lived in it would vanish with it.
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    deal: Deal | null;
    stage: DealStage;
  } | null>(null);
  // The deal whose tasks/actions working view is open.
  const [work, setWork] = useState<Deal | null>(null);
  // The deal an action is being created for, straight from its card.
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

  const allDeals = query.data?.deals ?? [];

  // Board view controls. Sorting is applied per column by KanbanBoard's own
  // ordering of the items it is handed, so sorting here sorts every column.
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("default");

  const deals = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = allDeals.filter((d) => {
      if (ownerFilter && d.ownerUserId !== ownerFilter) return false;
      if (!term) return true;
      // The fields someone actually types when hunting for a deal.
      return [
        d.title,
        d.accountName,
        d.leadName,
        d.contactName,
        d.location,
        d.products,
      ].some((v) => v?.toLowerCase().includes(term));
    });

    if (sortBy === "default") return filtered;

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "amountDesc":
          return b.amount - a.amount;
        case "amountAsc":
          return a.amount - b.amount;
        case "closeSoon":
          // Deals with no close date sink rather than claiming the top slot.
          return (a.expectedCloseDate ?? "9999").localeCompare(
            b.expectedCloseDate ?? "9999",
          );
        case "recent":
          return b.updatedAt.localeCompare(a.updatedAt);
        default:
          return 0;
      }
    });
  }, [allDeals, search, ownerFilter, sortBy]);

  const filtersActive =
    !!search.trim() || !!ownerFilter || sortBy !== "default";

  const totals = useMemo(() => {
    let open = 0;
    let won = 0;
    for (const deal of deals) {
      // Every stage before won is still in play, now that nothing is lost.
      if (deal.stage === "won") won += deal.amount;
      else open += deal.amount;
    }
    return { count: deals.length, open, won };
  }, [deals]);

  // The tracker is refetched alongside the board because the two share state:
  // reaching the delivery stage creates a row, editing the deployment fields
  // rewrites one, and deleting a deal unlinks one. Leaving it out meant the
  // table below the board kept showing what the deal used to say.
  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["deals"] });
    void queryClient.invalidateQueries({ queryKey: ["delivery"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient]);

  const move = useMutation({
    mutationFn: ({
      id,
      stage,
      index,
    }: {
      id: string;
      stage: string;
      index: number;
    }) => dealsApi.move(id, stage as DealStage, index),
    onError: (err) => {
      setMoveError(
        err instanceof ApiError ? err.message : "Could not move that deal",
      );
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

  // A delete that fails has to say so. It used to have no onError at all: the
  // dialog closed, nothing was invalidated, and the card sat there — including
  // the common case where the deal was already gone and the server answered 404,
  // which left a card on the board that no amount of clicking Delete could
  // remove. A 404 now resolves the same way a success does, because the board is
  // simply out of date.
  const remove = useMutation({
    mutationFn: (id: string) => dealsApi.remove(id),
    onSuccess: () => {
      setActionError(null);
      setDialog(null);
      invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 404) {
        setActionError(null);
        setDialog(null);
        invalidate();
        return;
      }
      setActionError(
        err instanceof ApiError ? err.message : "Could not delete that deal",
      );
    },
  });

  // Stable callbacks, so the memoised board and cards aren't invalidated on
  // every parent render.
  const onMove = useCallback(
    (id: string, stage: string, index: number) =>
      move.mutate({ id, stage, index }),
    [move],
  );
  const onOpen = useCallback(
    (deal: Deal) => setDialog({ deal, stage: deal.stage }),
    [],
  );
  const onAdd = useCallback(
    (stage: string) => setDialog({ deal: null, stage: stage as DealStage }),
    [],
  );
  const onOpenWork = useCallback((deal: Deal) => setWork(deal), []);

  // Ticking a task from the card. The server stamps who completed it, which is
  // the reason this is a request rather than a local edit.
  const toggleTask = useMutation({
    mutationFn: (task: DealTask) =>
      dealTasksApi.update(task.id, {
        text: task.text,
        priority: task.priority,
        assignedTo: task.assignedTo,
        done: !task.done,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dealTasks"] });
    },
    onError: (err) =>
      setActionError(
        err instanceof ApiError ? err.message : "Could not update that task",
      ),
  });
  const onToggleTask = useCallback(
    (task: DealTask) => toggleTask.mutate(task),
    [toggleTask],
  );

  // Completing here and completing on the Actions dashboard are the same call,
  // so the two surfaces can never disagree about an action's status.

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
        onOpenWork={onOpenWork}
        onGenerateQuote={onGenerateQuote}
        actions={actionsByDeal.get(deal.id)}
        tasks={tasksByDeal.get(deal.id)}
        canSeeActions={canSeeActions}
        onToggleTask={onToggleTask}
      />
    ),
    [
      onOpenWork,
      onGenerateQuote,
      actionsByDeal,
      tasksByDeal,
      canSeeActions,
      onToggleTask,
    ],
  );
  const columnSummary = useCallback(
    (items: Deal[]) => {
      const amount = items.reduce((sum, d) => sum + d.amount, 0);
      return amount > 0 ? formatMoneyCompact(amount, currency) : null;
    },
    [currency],
  );

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
          <Button
            icon="plus"
            onClick={() => setDialog({ deal: null, stage: "discovery" })}
          >
            New deal
          </Button>
        }
      />

      {moveError && <Alert>{moveError}</Alert>}
      {actionError && <Alert>{actionError}</Alert>}
      {query.isError && (
        <Alert>
          {query.error instanceof ApiError
            ? query.error.message
            : "Could not load the board"}
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

        {!boardCollapsed && (
          <div className="mb-sm flex flex-wrap items-center gap-sm">
            <div className="relative min-w-52 flex-1">
              <Icon
                name="search"
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search deals, clients, products…"
                aria-label="Search deals"
                className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              aria-label="Filter by owner"
              className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-fg-muted focus:border-accent focus:outline-none"
            >
              <option value="">All owners</option>
              {(members.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {memberLabel(m)}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              aria-label="Sort deals"
              className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-fg-muted focus:border-accent focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>

            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setOwnerFilter("");
                  setSortBy("default");
                }}
              >
                Clear
              </Button>
            )}

            <span className="ml-auto text-xs text-fg-subtle">
              {deals.length === allDeals.length
                ? `${allDeals.length} deals`
                : `${deals.length} of ${allDeals.length}`}
            </span>
          </div>
        )}

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
                  }
                }
              : undefined
          }
        />
      )}

      {work && <DealWorkDialog deal={work} onClose={() => setWork(null)} />}
    </section>
  );
}
