import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo } from "react";
import type { ReactNode } from "react";

interface SortableCardProps {
  id: string;
  stage: string;
  onOpen: () => void;
  children: ReactNode;
}

/**
 * Drag wiring only — the card's appearance comes from `children`, so the same
 * markup renders in the column and inside the DragOverlay.
 *
 * `memo` matters: dnd-kit re-renders the sortable context on every pointer move
 * during a drag. Without it a 60-card board reconciles every card per frame.
 */
export const SortableCard = memo(function SortableCard({
  id,
  stage,
  onOpen,
  children,
}: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { stage },
  });

  return (
    <div
      ref={setNodeRef}
      // Transform + opacity only: the card never triggers layout while moving.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`cursor-grab touch-manipulation active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
      onClick={onOpen}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
});
