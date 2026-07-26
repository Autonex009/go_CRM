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
import { useEffect, useMemo, useRef, useState } from "react";

import { Alert } from "../components/AuthLayout";
import { LeadCard, SortableLeadCard } from "../leads/LeadCard";
import { LeadDialog } from "../leads/LeadDialog";
import { leadsApi, type Lead, type LeadInput } from "../leads/api";
import { LEAD_STAGES, STAGE_META, formatValue, type LeadStage } from "../leads/stages";
import { ApiError } from "../lib/api";

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

  // The board is local state during a drag, so it can't be stomped by a refetch
  // mid-gesture; it re-syncs from the query whenever the server data settles.
  const dragging = useRef(false);
  useEffect(() => {
    if (query.data && !dragging.current) {
      setBoard(group(query.data.leads));
    }
  }, [query.data]);

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so clicking a card to open it
    // still works.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeLead = useMemo(
    () => (activeId ? LEAD_STAGES.flatMap((s) => board[s]).find((l) => l.id === activeId) : null),
    [activeId, board],
  );

  const move = useMutation({
    mutationFn: ({ id, stage, index }: { id: string; stage: LeadStage; index: number }) =>
      leadsApi.move(id, stage, index),
    onError: (err) => {
      setMoveError(err instanceof ApiError ? err.message : "Could not move that lead");
      // Local state and the server have diverged — the server wins.
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onSuccess: () => {
      setMoveError(null);
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const save = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: LeadInput }) =>
      id ? leadsApi.update(id, input) : leadsApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => leadsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
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
      // Dropped outside any column — discard the optimistic reshuffle.
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

  const total = LEAD_STAGES.reduce((n, s) => n + board[s].length, 0);

  return (
    <section className="flex flex-col gap-lg">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Leads</h1>
          <p className="mt-xs text-sm text-neutral-500">
            {total === 0 ? "No leads yet" : `${total} in the pipeline`} · drag a card to move it
          </p>
        </div>
        <button
          onClick={() => setDialog({ lead: null, stage: "new" })}
          className="rounded-md bg-brand-600 px-md py-sm text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          New lead
        </button>
      </header>

      {moveError && <Alert>{moveError}</Alert>}
      {query.isError && (
        <Alert>
          {query.error instanceof ApiError ? query.error.message : "Could not load the board"}
        </Alert>
      )}

      {query.isPending ? (
        <p className="text-sm text-neutral-500">Loading board…</p>
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
          {/* Horizontal scroll rather than squeezing six columns onto a phone. */}
          <div className="-mx-lg flex gap-md overflow-x-auto px-lg pb-md">
            {LEAD_STAGES.map((stage) => (
              <Column
                key={stage}
                stage={stage}
                leads={board[stage]}
                onAdd={() => setDialog({ lead: null, stage })}
                onOpen={(lead) => setDialog({ lead, stage })}
              />
            ))}
          </div>

          {/* Follows the pointer; the card left behind stays faint. */}
          <DragOverlay>{activeLead && <LeadCard lead={activeLead} overlay />}</DragOverlay>
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

interface ColumnProps {
  stage: LeadStage;
  leads: Lead[];
  onAdd: () => void;
  onOpen: (lead: Lead) => void;
}

function Column({ stage, leads, onAdd, onOpen }: ColumnProps) {
  // Droppable on the column itself, so an empty column is still a target.
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const meta = STAGE_META[stage];
  const value = leads.reduce((sum, l) => sum + (l.value ?? 0), 0);

  return (
    <div className="flex w-[260px] shrink-0 flex-col gap-sm">
      <header className="flex items-center justify-between px-xs">
        <div className="flex items-center gap-sm">
          <span className={`h-[6px] w-[6px] rounded-full ${meta.dot}`} />
          <h2 className="text-sm font-semibold text-neutral-900">{meta.label}</h2>
          <span className="text-xs tabular-nums text-neutral-500">{leads.length}</span>
        </div>
        {value > 0 && (
          <span className="text-xs tabular-nums text-neutral-500">{formatValue(value)}</span>
        )}
      </header>

      <div
        ref={setNodeRef}
        className={`flex min-h-[120px] flex-col gap-sm rounded-lg border p-sm transition ${
          isOver ? "border-brand-500 bg-brand-50/40" : "border-neutral-900/10 bg-neutral-50"
        }`}
      >
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <SortableLeadCard key={lead.id} lead={lead} onOpen={() => onOpen(lead)} />
          ))}
        </SortableContext>

        <button
          onClick={onAdd}
          className="rounded-md px-sm py-xs text-left text-xs font-medium text-neutral-500 transition hover:bg-white hover:text-neutral-900"
        >
          + Add lead
        </button>
      </div>
    </div>
  );
}
