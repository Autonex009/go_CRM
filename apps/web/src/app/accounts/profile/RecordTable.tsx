import type { ReactNode } from "react";

import { EmptyState } from "../../ui";
import type { IconName } from "../../ui";

export interface RecordColumn<T> {
  key: string;
  header: string;
  /** Numbers and money read right-aligned; everything else left. */
  align?: "left" | "right";
  /** Dropped below `md`, for columns a narrow screen can do without. */
  secondary?: boolean;
  cell: (row: T) => ReactNode;
}

/**
 * The read-only table every list in the company profile renders through.
 *
 * The profile is a report on a company, not a second place to author its
 * records: deals, leads, quotes and invoices are created and edited on their own
 * pages. So there is deliberately no row action here — a table with no edit
 * affordance is the whole point, and one added to this component would appear on
 * four screens at once.
 */
export function RecordTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  footer,
  minWidth = 640,
}: {
  columns: RecordColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty: { icon?: IconName; title: string; description?: string };
  /** A totals row, rendered in `tfoot` so it stays put when the body scrolls. */
  footer?: ReactNode;
  minWidth?: number;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        size="sm"
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
      />
    );
  }

  return (
    // Full-bleed inside the card's padding, so the header rule spans the panel.
    <div className="-mx-lg overflow-x-auto">
      <table
        className="w-full text-left text-sm tabular-nums"
        style={{ minWidth }}
      >
        <thead className="border-y border-line bg-surface-muted text-[11px] font-medium uppercase tracking-wide text-fg-muted">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cellClass(c, "px-lg py-sm font-medium")}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-line/70 transition-colors duration-100 last:border-0 hover:bg-surface-hover"
            >
              {columns.map((c) => (
                <td key={c.key} className={cellClass(c, "px-lg py-sm")}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot className="border-t border-line-strong bg-surface-muted/60 text-xs">
            {footer}
          </tfoot>
        )}
      </table>
    </div>
  );
}

function cellClass<T>(column: RecordColumn<T>, base: string): string {
  return [
    base,
    column.align === "right" ? "text-right" : "",
    column.secondary ? "hidden md:table-cell" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** A totals row for `RecordTable`'s footer, aligned to the same columns. */
export function TotalsRow({
  cells,
}: {
  cells: { key: string; value: ReactNode; align?: "left" | "right"; secondary?: boolean }[];
}) {
  return (
    <tr>
      {cells.map((c) => (
        <td
          key={c.key}
          className={[
            "px-lg py-sm font-semibold text-fg",
            c.align === "right" ? "text-right" : "",
            c.secondary ? "hidden md:table-cell" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {c.value}
        </td>
      ))}
    </tr>
  );
}
