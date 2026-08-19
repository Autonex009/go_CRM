import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { KanbanColumn } from "./KanbanColumn";
import { SortableCard } from "./SortableCard";
import type { Tone } from "../primitives";

/** Anything with an id and a column key can go on the board. */
export interface KanbanItem {
  id: string;
  stage: string;
}

export interface KanbanColumnDef {
  key: string;
  label: string;
  tone: Tone;
  /** Tailwind background class for the column's funnel rule. */
  bar: string;
}

interface KanbanBoardProps<T extends KanbanItem> {
  columns: readonly KanbanColumnDef[];
  items: T[];
  /** Card body. Receives `overlay` while rendered inside the drag overlay. */
  renderCard: (item: T, overlay: boolean) => ReactNode;
  /** Commit a drop: target column and index within it. */
  onMove: (id: string, stage: string, index: number) => void;
  onOpen: (item: T) => void;
  onAdd: (stage: string) => void;
  /** Right-aligned summary in a column header, e.g. total value. */
  columnSummary?: (items: T[]) => ReactNode;
  addLabel?: string;
}

type Grouped<T> = Record<string, T[]>;

function group<T extends KanbanItem>(items: T[], columns: readonly KanbanColumnDef[]): Grouped<T> {
  const out: Grouped<T> = {};
  for (const column of columns) out[column.key] = [];
  for (const item of items) (out[item.stage] ??= []).push(item);
  return out;
}

/**
 * Generic drag-and-drop board, shared by the leads and deals pipelines.
 *
 * Everything domain-specific arrives as props — the columns, the card body, and
 * what a move means. Extracted rather than copied so a fix to the drag mechanics
 * (which are the fiddly part) lands in both pipelines at once.
 */
export function KanbanBoard<T extends KanbanItem>({
  columns,
  items,
  renderCard,
  onMove,
  onOpen,
  onAdd,
  columnSummary,
  addLabel = "Add",
}: KanbanBoardProps<T>) {
  const [board, setBoard] = useState<Grouped<T>>(() => group(items, columns));
  const [activeId, setActiveId] = useState<string | null>(null);

  // Local state during a drag, so a background refetch can't yank a card out
  // from under the pointer; re-syncs once the server data settles.
  const dragging = useRef(false);
  useEffect(() => {
    if (!dragging.current) setBoard(group(items, columns));
  }, [items, columns]);

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so click-to-open still works.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const stageOf = useCallback(
    (grouped: Grouped<T>, id: string): string | undefined => {
      if (id in grouped) return id;
      return columns.find((c) => grouped[c.key]?.some((i) => i.id === id))?.key;
    },
    [columns],
  );

  const activeItem = useMemo(() => {
    if (!activeId) return null;
    for (const column of columns) {
      const found = board[column.key]?.find((i) => i.id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, board, columns]);

  const onDragStart = ({ active }: DragStartEvent) => {
    dragging.current = true;
    setActiveId(String(active.id));
  };

  // Fires while hovering a different column: move the card across immediately so
  // the drop target reads the way it looks.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const id = String(active.id);
    const from = stageOf(board, id);
    const to = stageOf(board, String(over.id));
    if (!from || !to || from === to) return;

    setBoard((prev) => {
      const fromItems = [...(prev[from] ?? [])];
      const toItems = [...(prev[to] ?? [])];
      const index = fromItems.findIndex((i) => i.id === id);
      if (index < 0) return prev;

      const [moved] = fromItems.splice(index, 1);
      const overIndex = toItems.findIndex((i) => i.id === String(over.id));
      toItems.splice(overIndex >= 0 ? overIndex : toItems.length, 0, { ...moved, stage: to });

      return { ...prev, [from]: fromItems, [to]: toItems };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    dragging.current = false;
    setActiveId(null);
    if (!over) {
      setBoard(group(items, columns));
      return;
    }

    const id = String(active.id);
    const stage = stageOf(board, String(over.id));
    if (!stage) return;

    const columnItems = board[stage] ?? [];
    const oldIndex = columnItems.findIndex((i) => i.id === id);
    const overIndex = columnItems.findIndex((i) => i.id === String(over.id));

    let ordered = columnItems;
    if (oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex) {
      ordered = arrayMove(columnItems, oldIndex, overIndex);
      setBoard((prev) => ({ ...prev, [stage]: ordered }));
    }

    const index = ordered.findIndex((i) => i.id === id);
    onMove(id, stage, index < 0 ? ordered.length : index);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        dragging.current = false;
        setActiveId(null);
        setBoard(group(items, columns));
      }}
    >
      {/* Horizontal scroll rather than squeezing every column onto a phone.
          Negative margin lets the strip bleed to the viewport edge. */}
      <div className="-mx-md flex gap-md overflow-x-auto px-md pb-sm sm:-mx-lg sm:px-lg">
        {columns.map((column) => {
          const columnItems = board[column.key] ?? [];
          return (
            <KanbanColumn
              key={column.key}
              column={column}
              count={columnItems.length}
              summary={columnSummary?.(columnItems)}
              itemIds={columnItems.map((i) => i.id)}
              addLabel={addLabel}
              onAdd={onAdd}
            >
              {columnItems.map((item) => (
                <SortableCard key={item.id} id={item.id} stage={column.key} onOpen={() => onOpen(item)}>
                  {renderCard(item, false)}
                </SortableCard>
              ))}
            </KanbanColumn>
          );
        })}
      </div>

      <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.16,1,0.3,1)" }}>
        {activeItem && <div className="w-[264px]">{renderCard(activeItem, true)}</div>}
      </DragOverlay>
    </DndContext>
  );
}
