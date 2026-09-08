import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";

import { ApiError } from "../lib/api";
import { Alert, Button, Card, Icon, Spinner } from "../ui";
import { ImportDialog } from "./ImportDialog";
import { RowMenu, type RowMenuTarget } from "./RowMenu";
import { TrackerCell } from "./TrackerCell";
import {
  TRACKER_COLUMNS,
  blankRow,
  deliveryApi,
  toInput,
  type TrackerColumn,
  type TrackerInput,
  type TrackerRow,
} from "./api";

/**
 * The client delivery tracker: the spreadsheet operations keeps, as a table that
 * saves.
 *
 * Edits commit per cell rather than behind a Save button. The sheet this
 * replaces had no save step either, and a modal-per-row would make the one thing
 * people do here — glance across a client and fix a stale cell — the slowest
 * possible interaction.
 */
export function TrackerTable() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["delivery"], queryFn: deliveryApi.list });

  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [menu, setMenu] = useState<RowMenuTarget | null>(null);
  const gridRef = useRef<HTMLTableSectionElement>(null);

  const rows = query.data?.items ?? [];

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return rows;
    // Search the whole row: people look for a location or a contact as often as
    // a client name, and a per-column filter UI is more chrome than this earns.
    return rows.filter((row) =>
      TRACKER_COLUMNS.some((col) =>
        String(row[col.key] ?? "")
          .toLowerCase()
          .includes(needle),
      ),
    );
  }, [rows, filter]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["delivery"] });
  }, [queryClient]);

  const fail = useCallback(
    (err: unknown, fallback: string) => {
      setError(err instanceof ApiError ? err.message : fallback);
      // The optimistic edit and the server have diverged; the server wins.
      invalidate();
    },
    [invalidate],
  );

  const save = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TrackerInput }) =>
      deliveryApi.update(id, input),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => fail(err, "Could not save that change"),
  });

  const add = useMutation({
    mutationFn: (input: TrackerInput) => deliveryApi.create(input),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => fail(err, "Could not add that row"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deliveryApi.remove(id),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => fail(err, "Could not delete that row"),
  });

  // One delete path for both affordances, so the confirmation copy and the
  // behaviour cannot drift apart. The tracker has no soft delete — the row is
  // gone — which is what the confirm is for.
  const confirmDelete = useCallback(
    (id: string, client: string) => {
      setMenu(null);
      if (
        window.confirm(
          `Delete the tracker row for ${client}? This cannot be undone.`,
        )
      ) {
        remove.mutate(id);
      }
    },
    [remove],
  );

  const onCommit = useCallback(
    (row: TrackerRow, column: TrackerColumn, value: string | number | null) => {
      // The client names the row for the importer's upsert, so blanking it would
      // orphan the line. Refuse and let the refetch restore what was there.
      if (column.key === "client" && !String(value ?? "").trim()) {
        setError("A row needs a client name — delete the row instead.");
        invalidate();
        return;
      }
      save.mutate({
        id: row.id,
        input: { ...toInput(row), [column.key]: value },
      });
    },
    [save, invalidate],
  );

  // Arrow/Tab movement across the grid. Cells are addressed by data attributes
  // rather than a ref matrix, so adding a column does not mean rewiring this.
  const navigate = useCallback(
    (
      rowIndex: number,
      colIndex: number,
      key: "up" | "down" | "left" | "right",
    ) => {
      const deltas = {
        up: [-1, 0],
        down: [1, 0],
        left: [0, -1],
        right: [0, 1],
      } as const;
      const [dr, dc] = deltas[key];

      let nextRow = rowIndex + dr;
      let nextCol = colIndex + dc;

      // Tabbing off either end wraps to the neighbouring row, the way a
      // spreadsheet does.
      if (nextCol < 0) {
        nextCol = TRACKER_COLUMNS.length - 1;
        nextRow -= 1;
      } else if (nextCol >= TRACKER_COLUMNS.length) {
        nextCol = 0;
        nextRow += 1;
      }

      const target = gridRef.current?.querySelector<HTMLInputElement>(
        `[data-cell="${nextRow}-${nextCol}"]`,
      );
      target?.focus();
      target?.select();
    },
    [],
  );

  const exportCsv = useCallback(() => {
    const header = TRACKER_COLUMNS.map((c) => c.label);
    const body = visible.map((row) =>
      TRACKER_COLUMNS.map((col) => {
        const raw = row[col.key];
        return col.type === "date" && typeof raw === "string"
          ? raw.slice(0, 10)
          : (raw ?? "");
      }),
    );
    downloadCsv([header, ...body]);
  }, [visible]);

  return (
    <Card padded={false} className="overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-sm border-b border-line px-lg py-md">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-fg">
            Client delivery tracker
          </h2>
          <p className="text-xs text-fg-muted">
            {query.isPending
              ? "Loading…"
              : `${rows.length} client${rows.length === 1 ? "" : "s"}${
                  filter ? ` · ${visible.length} matching` : ""
                } · edits save as you leave a cell`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-sm">
          <label className="relative">
            <span className="sr-only">Filter the tracker</span>
            <Icon
              name="search"
              size={14}
              className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-fg-subtle"
            />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter…"
              className="h-[30px] w-[160px] rounded-md border border-line bg-surface pl-[28px] pr-sm text-xs text-fg outline-none focus:border-accent"
            />
          </label>
          <Button
            variant="secondary"
            size="sm"
            icon="download"
            onClick={exportCsv}
          >
            Export
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            onClick={() => setImporting(true)}
          >
            Import sheet
          </Button>
        </div>
      </header>

      {error && (
        <div className="px-lg pt-md">
          <Alert>{error}</Alert>
        </div>
      )}
      {toast && (
        <div className="px-lg pt-md">
          <Alert tone="success">{toast}</Alert>
        </div>
      )}
      {query.isError && (
        <div className="px-lg pt-md">
          <Alert>
            {query.error instanceof ApiError
              ? query.error.message
              : "Could not load the delivery tracker"}
          </Alert>
        </div>
      )}

      {/* Both axes scroll inside this box so the header and the row gutter can
          stay pinned — a ten-column sheet is unreadable once the client name
          scrolls off the left. */}
      <div className="max-h-[540px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#1e3a5f] text-white">
              {/* Row-number gutter, like a spreadsheet's. */}
              <th
                scope="col"
                className="sticky left-0 top-0 z-30 w-[44px] min-w-[44px] border-b border-r border-white/25 bg-[#1e3a5f] px-xs py-sm text-center text-xs font-semibold"
              >
                <span className="sr-only">Row</span>#
              </th>
              {TRACKER_COLUMNS.map((column, index) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`sticky top-0 whitespace-nowrap border-b border-r border-white/25 bg-[#1e3a5f] px-sm py-sm text-left text-xs font-semibold uppercase tracking-wide ${column.width} ${
                    // The client column pins alongside the gutter.
                    index === 0 ? "left-[44px] z-30" : "z-20"
                  }`}
                >
                  {column.label}
                </th>
              ))}
              {/* Pinned to the right edge: with ten columns the actions used to
                  sit past the horizontal scroll, where nobody found them. */}
              <th
                scope="col"
                className="sticky right-0 top-0 z-30 w-[48px] min-w-[48px] border-b border-l border-white/25 bg-[#1e3a5f] px-xs py-sm text-center text-xs font-semibold uppercase tracking-wide"
              >
                <span className="sr-only">Delete row</span>
                <Icon name="close" size={13} className="mx-auto opacity-70" />
              </th>
            </tr>
          </thead>

          <tbody ref={gridRef}>
            {query.isPending && (
              <tr>
                <td
                  colSpan={TRACKER_COLUMNS.length + 2}
                  className="px-lg py-xl text-center"
                >
                  <Spinner />
                </td>
              </tr>
            )}

            {!query.isPending && visible.length === 0 && (
              <tr>
                <td
                  colSpan={TRACKER_COLUMNS.length + 2}
                  className="px-lg py-xl text-center text-sm text-fg-muted"
                >
                  {filter
                    ? "Nothing matches that filter."
                    : "No rows yet — add one below, or import your sheet."}
                </td>
              </tr>
            )}

            {visible.map((row, rowIndex) => (
              <tr
                key={row.id}
                className="group"
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({
                    x: e.clientX,
                    y: e.clientY,
                    id: row.id,
                    client: row.client,
                  });
                }}
              >
                <td
                  title="Right-click for row actions"
                  className="sticky left-0 z-10 w-[44px] min-w-[44px] cursor-context-menu border-b border-r border-line bg-surface-muted px-xs text-center text-xs tabular-nums text-fg-subtle"
                >
                  {rowIndex + 1}
                </td>
                {TRACKER_COLUMNS.map((column, colIndex) => (
                  <td
                    key={column.key}
                    className={`border-b border-r border-line p-0 align-middle ${
                      // Opaque, because the row scrolls underneath it.
                      colIndex === 0
                        ? "sticky left-[44px] z-10 bg-surface"
                        : "bg-surface"
                    }`}
                  >
                    <TrackerCell
                      cellId={`${rowIndex}-${colIndex}`}
                      column={column}
                      value={toInput(row)[column.key]}
                      onCommit={(value) => onCommit(row, column, value)}
                      onNavigate={(key) => navigate(rowIndex, colIndex, key)}
                    />
                  </td>
                ))}
                <td className="sticky right-0 z-10 w-[48px] min-w-[48px] border-b border-l border-line bg-surface px-[2px] text-center">
                  {/* Always visible, not hover-only: a delete you have to
                      discover by sweeping the pointer over a row is a delete
                      nobody finds. It stays quiet until you approach it. */}
                  <button
                    type="button"
                    aria-label={`Delete ${row.client}`}
                    title={`Delete ${row.client}`}
                    disabled={remove.isPending}
                    onClick={() => confirmDelete(row.id, row.client)}
                    className="rounded-sm p-xs text-fg-subtle opacity-60 transition-all duration-100 hover:bg-bad-soft hover:text-bad-fg hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed group-hover:opacity-100"
                  >
                    <Icon name="close" size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NewRow onAdd={(input) => add.mutate(input)} busy={add.isPending} />

      {menu && (
        <RowMenu
          target={menu}
          onDelete={() => confirmDelete(menu.id, menu.client)}
          onClose={() => setMenu(null)}
        />
      )}

      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          onImported={(created, updated) => {
            setImporting(false);
            setToast(
              `Imported ${created} new and ${updated} updated row${updated === 1 ? "" : "s"}.`,
            );
            invalidate();
            window.setTimeout(() => setToast(null), 6000);
          }}
        />
      )}
    </Card>
  );
}

/**
 * The add-a-row line at the bottom of the table.
 *
 * Only the client is asked for: the row has to exist before the other cells can
 * be typed into, and asking for ten fields up front is the modal this table is
 * trying not to be.
 */
function NewRow({
  onAdd,
  busy,
}: {
  onAdd: (input: TrackerInput) => void;
  busy: boolean;
}) {
  const [client, setClient] = useState("");

  const submit = () => {
    const name = client.trim();
    if (!name) return;
    onAdd({ ...blankRow(), client: name });
    setClient("");
  };

  return (
    <div className="flex items-center gap-sm border-t border-line bg-surface-muted/60 px-lg py-sm">
      <Icon name="plus" size={13} className="text-fg-subtle" />
      <input
        value={client}
        onChange={(e) => setClient(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Add a client…"
        aria-label="New client name"
        className="h-[28px] flex-1 rounded-sm border border-transparent bg-transparent px-xs text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent focus:bg-surface"
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={submit}
        disabled={busy || !client.trim()}
      >
        Add row
      </Button>
    </div>
  );
}

/** Builds a CSV and hands it to the browser as a download. */
function downloadCsv(grid: (string | number)[][]) {
  const csv = grid
    .map((line) =>
      line
        .map((cell) => {
          const text = String(cell);
          // Quote anything that would otherwise break the row apart, and double
          // any embedded quote — the two rules that make CSV survive Excel.
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(","),
    )
    .join("\n");

  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `delivery-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
