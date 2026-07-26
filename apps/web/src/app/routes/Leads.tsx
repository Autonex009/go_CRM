import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "../lib/api";
import { LeadCard, SortableLeadCard } from "../leads/LeadCard";
import { LeadDialog } from "../leads/LeadDialog";
import { leadsApi, type Lead, type LeadInput } from "../leads/api";
import { LEAD_STAGES, STAGE_META, formatCompact, type LeadStage } from "../leads/stages";
import { Alert, Button, Dot, Icon, PageHeader, Skeleton } from "../ui";

/** Columns keyed by stage, in board order. */
type BoardState = Record<LeadStage, Lead[]>;

function emptyBoard(): BoardState {
  const board = {} as BoardState;
  for (const stage of LEAD_STAGES) {
    board[stage] = [];
  }
  return board;
}

/** The server returns leads ordered by (stage, position), so grouping preserves it. */
function group(leads: Lead[]): BoardState {
  const board = emptyBoard();
  for (const lead of leads) {
    (board[lead.stage] ??= []).push(lead);
  }
  return board;
}

/** Which column holds `id` — or `id` itself when it names an (empty) column. */
function stageOf(board: BoardState, id: string): LeadStage | undefined {
  if (id in board) return id as LeadStage;
  return LEAD_STAGES.find((stage) => board[stage].some((lead) => lead.id === id));
}

export default function Leads() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["leads"], queryFn: leadsApi.board });

  const [board, setBoard] = useState<BoardState>(emptyBoard);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ lead: Lead | null; stage: LeadStage } | null>(null);

  // The board is local state during a drag, so a background refetch can't yank a
  // card out from under the pointer; it re-syncs once server data settles.
  const dragging = useRef(false);
  useEffect(() => {
    if (query.data && !dragging.current) {
      setBoard(group(query.data.leads));
    }
  }, [query.data]);

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so click-to-open still works.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeLead = useMemo(
    () => (activeId ? LEAD_STAGES.flatMap((s) => board[s]).find((l) => l.id === activeId) : null),
    [activeId, board],
  );

  const totals = useMemo(() => {
    let count = 0;
    let open = 0;
    for (const stage of LEAD_STAGES) {
      count += board[stage].length;
      if (stage !== "won" && stage !== "lost") {
        for (const lead of board[stage]) open += lead.value ?? 0;
      }
    }
    return { count, open };
  }, [board]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient]);

  const move = useMutation({
    mutationFn: ({ id, stage, index }: { id: string; stage: LeadStage; index: number }) =>
      leadsApi.move(id, stage, index),
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

  const onDragStart = ({ active }: DragStartEvent) => {
    dragging.current = true;
    setActiveId(String(active.id));
  };

  // Fires while hovering a different column: move the card across immediately so
  // the drop target reads the way it looks.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeIdStr = String(active.id);
    const from = stageOf(board, activeIdStr);
    const to = stageOf(board, String(over.id));
    if (!from || !to || from === to) return;

    setBoard((prev) => {
      const fromItems = [...prev[from]];
      const toItems = [...prev[to]];
      const index = fromItems.findIndex((l) => l.id === activeIdStr);
      if (index < 0) return prev;

      const [moved] = fromItems.splice(index, 1);
      const overIndex = toItems.findIndex((l) => l.id === String(over.id));
      toItems.splice(overIndex >= 0 ? overIndex : toItems.length, 0, { ...moved, stage: to });

      return { ...prev, [from]: fromItems, [to]: toItems };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    dragging.current = false;
    setActiveId(null);
    if (!over) {
      setBoard(group(query.data?.leads ?? []));
      return;
    }

    const id = String(active.id);
    const stage = stageOf(board, String(over.id));
    if (!stage) return;

    const items = board[stage];
    const oldIndex = items.findIndex((l) => l.id === id);
    const overIndex = items.findIndex((l) => l.id === String(over.id));

    let ordered = items;
    if (oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex) {
      ordered = arrayMove(items, oldIndex, overIndex);
      setBoard((prev) => ({ ...prev, [stage]: ordered }));
    }

    const index = ordered.findIndex((l) => l.id === id);
    move.mutate({ id, stage, index: index < 0 ? ordered.length : index });
  };

  const openLead = useCallback(
    (lead: Lead) => setDialog({ lead, stage: lead.stage }),
    [],
  );

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
        <BoardSkeleton />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            dragging.current = false;
            setActiveId(null);
            setBoard(group(query.data?.leads ?? []));
          }}
        >
          {/* Horizontal scroll rather than squeezing six columns onto a phone.
              Negative margin lets the strip bleed to the viewport edge. */}
          <div className="-mx-md flex gap-md overflow-x-auto px-md pb-sm sm:-mx-lg sm:px-lg">
            {LEAD_STAGES.map((stage) => (
              <Column
                key={stage}
                stage={stage}
                leads={board[stage]}
                onAdd={setDialog}
                onOpen={openLead}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.16,1,0.3,1)" }}>
            {activeLead && (
              <div className="w-[264px]">
                <LeadCard lead={activeLead} overlay />
              </div>
            )}
          </DragOverlay>
        </DndContext>
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

/* -------------------------------------------------------------------------- */

interface ColumnProps {
  stage: LeadStage;
  leads: Lead[];
  onAdd: (d: { lead: null; stage: LeadStage }) => void;
  onOpen: (lead: Lead) => void;
}

const Column = memo(function Column({ stage, leads, onAdd, onOpen }: ColumnProps) {
  // Droppable on the column body, so an empty column is still a target.
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const meta = STAGE_META[stage];

  const value = useMemo(() => leads.reduce((sum, l) => sum + (l.value ?? 0), 0), [leads]);
  const ids = useMemo(() => leads.map((l) => l.id), [leads]);

  return (
    <div className="flex w-[264px] shrink-0 flex-col">
      {/* Funnel rule: the board reads as stages left to right. */}
      <span className={`h-[3px] rounded-full ${meta.bar}`} />

      <header className="flex items-center justify-between gap-sm px-xs py-sm">
        <div className="flex min-w-0 items-center gap-sm">
          <Dot tone={meta.tone} />
          <h2 className="truncate text-xs font-semibold uppercase tracking-wide text-neutral-600">
            {meta.label}
          </h2>
          <span className="rounded-full bg-neutral-100 px-xs text-xs font-medium tabular-nums text-neutral-500">
            {leads.length}
          </span>
        </div>
        {value > 0 && (
          <span className="shrink-0 text-xs font-medium tabular-nums text-neutral-500">
            {formatCompact(value)}
          </span>
        )}
      </header>

      <div
        ref={setNodeRef}
        className={`flex min-h-[140px] flex-1 flex-col gap-sm rounded-lg border p-sm transition-colors duration-100 ${
          isOver ? "border-brand-400 bg-brand-50/60" : "border-neutral-200 bg-neutral-100/60"
        }`}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <SortableLeadCard key={lead.id} lead={lead} onOpen={onOpen} />
          ))}
        </SortableContext>

        <button
          type="button"
          onClick={() => onAdd({ lead: null, stage })}
          className="flex h-[32px] items-center justify-center gap-xs rounded-md text-xs font-medium text-neutral-500 transition-colors duration-100 hover:bg-white hover:text-neutral-900"
        >
          <Icon name="plus" size={13} />
          Add lead
        </button>
      </div>
    </div>
  );
});

/** Mirrors the real board's geometry so nothing shifts when data lands. */
function BoardSkeleton() {
  return (
    <div className="-mx-md flex gap-md overflow-hidden px-md sm:-mx-lg sm:px-lg">
      {LEAD_STAGES.map((stage, column) => (
        <div key={stage} className="flex w-[264px] shrink-0 flex-col">
          <span className={`h-[3px] rounded-full ${STAGE_META[stage].bar} opacity-40`} />
          <div className="px-xs py-sm">
            <Skeleton className="h-[14px] w-[88px]" />
          </div>
          <div className="flex flex-col gap-sm rounded-lg border border-neutral-200 bg-neutral-100/60 p-sm">
            {Array.from({ length: column % 2 === 0 ? 2 : 1 }).map((_, i) => (
              <Skeleton key={i} className="h-[86px] w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
