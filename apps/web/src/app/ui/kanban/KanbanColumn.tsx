import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { memo, useMemo } from "react";
import type { ReactNode } from "react";

import { Icon } from "../Icon";
import { Dot } from "../primitives";
import type { KanbanColumnDef } from "./KanbanBoard";

interface KanbanColumnProps {
  column: KanbanColumnDef;
  count: number;
  summary?: ReactNode;
  itemIds: string[];
  children: ReactNode;
  addLabel: string;
  onAdd: (stage: string) => void;
}

/** One board column: funnel rule, header, sortable card list, add button. */
export const KanbanColumn = memo(function KanbanColumn({
  column,
  count,
  summary,
  itemIds,
  children,
  addLabel,
  onAdd,
}: KanbanColumnProps) {
  // Droppable on the column body, so an empty column is still a target.
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  // dnd-kit compares this array by identity on every pointer move.
  const ids = useMemo(() => itemIds, [itemIds.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex w-[264px] shrink-0 flex-col">
      {/* Funnel rule: the board reads as stages, left to right. */}
      <span className={`h-[3px] rounded-full ${column.bar}`} />

      <header className="flex items-center justify-between gap-sm px-xs py-sm">
        <div className="flex min-w-0 items-center gap-sm">
          <Dot tone={column.tone} />
          <h2 className="truncate text-xs font-semibold uppercase tracking-wide text-fg-muted">
            {column.label}
          </h2>
          <span className="rounded-full bg-surface-muted px-xs text-xs font-medium tabular-nums text-fg-muted">
            {count}
          </span>
        </div>
        {summary && (
          <span className="shrink-0 text-xs font-medium tabular-nums text-fg-muted">{summary}</span>
        )}
      </header>

      <div
        ref={setNodeRef}
        className={`flex min-h-[140px] flex-1 flex-col gap-sm rounded-lg border p-sm transition-colors duration-100 ${
          isOver ? "border-accent bg-accent-soft/50" : "border-line bg-surface-muted/60"
        }`}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>

        <button
          type="button"
          onClick={() => onAdd(column.key)}
          className="flex h-[32px] items-center justify-center gap-xs rounded-md text-xs font-medium text-fg-muted transition-colors duration-100 hover:bg-surface hover:text-fg"
        >
          <Icon name="plus" size={13} />
          {addLabel}
        </button>
      </div>
    </div>
  );
});
