import { Skeleton } from "../primitives";
import type { KanbanColumnDef } from "./KanbanBoard";

/**
 * Placeholder that mirrors the real board's geometry — same column width, same
 * card height — so nothing shifts when the data lands.
 */
export function BoardSkeleton({ columns }: { columns: readonly KanbanColumnDef[] }) {
  return (
    <div className="-mx-md flex gap-md overflow-hidden px-md sm:-mx-lg sm:px-lg">
      {columns.map((column, index) => (
        <div key={column.key} className="flex w-[264px] shrink-0 flex-col">
          <span className={`h-[3px] rounded-full ${column.bar} opacity-40`} />
          <div className="px-xs py-sm">
            <Skeleton className="h-[14px] w-[88px]" />
          </div>
          <div className="flex flex-col gap-sm rounded-lg border border-line bg-surface-muted/60 p-sm">
            {Array.from({ length: index % 2 === 0 ? 2 : 1 }).map((_, i) => (
              <Skeleton key={i} className="h-[86px] w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
