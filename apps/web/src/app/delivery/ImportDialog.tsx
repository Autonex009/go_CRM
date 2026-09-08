import { useState } from "react";

import { ApiError } from "../lib/api";
import { Alert, Badge, Button, Modal } from "../ui";
import { deliveryApi, type ImportPreview, type PreviewRow } from "./api";

interface ImportDialogProps {
  onClose: () => void;
  onImported: (created: number, updated: number) => void;
}

/**
 * Upload → preview → commit.
 *
 * The two steps are the point: an import that upserts on the client name can
 * quietly overwrite a column someone filled in this morning, so nothing is
 * written until the user has seen which rows are new, which change, and what
 * exactly changes about them.
 */
export function ImportDialog({ onClose, onImported }: ImportDialogProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(work: () => Promise<T>, then: (result: T) => void) {
    setBusy(true);
    setError(null);
    try {
      then(await work());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const onFile = (file: File) => {
    setFileName(file.name);
    setPreview(null);
    void run(
      () => deliveryApi.previewImport(file),
      (result) => setPreview(result),
    );
  };

  const commit = () => {
    if (!preview) return;
    // "unchanged" rows are dropped rather than sent: writing them would bump
    // updated_by and make it look like someone edited every line.
    const rows = preview.rows
      .filter((r) => r.action !== "unchanged")
      .map((r) => r.values);
    if (rows.length === 0) {
      onClose();
      return;
    }
    void run(
      () => deliveryApi.commitImport(rows),
      (result) => onImported(result.created, result.updated),
    );
  };

  const willWrite = preview ? preview.created + preview.updated : 0;

  return (
    <Modal title="Import tracker sheet" onClose={onClose}>
      <div className="flex flex-col gap-md">
        {error && <Alert>{error}</Alert>}

        <label className="flex cursor-pointer flex-col items-center justify-center gap-xs rounded-lg border border-dashed border-line px-lg py-xl text-center transition-colors duration-100 hover:border-accent hover:bg-accent-soft/30">
          <span className="text-sm font-medium text-fg">
            {fileName ?? "Choose an .xlsx or .csv file"}
          </span>
          <span className="text-xs text-fg-muted">
            The first sheet is read. A title row above the headings is fine.
          </span>
          <input
            type="file"
            accept=".xlsx,.xlsm,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              // Reset, so picking the same file twice re-previews it.
              e.target.value = "";
            }}
          />
        </label>

        {busy && <p className="text-sm text-fg-muted">Reading the sheet…</p>}

        {preview && !busy && (
          <>
            <div className="flex flex-wrap items-center gap-sm text-sm">
              <Badge tone="success">{preview.created} new</Badge>
              <Badge tone="warning">{preview.updated} updated</Badge>
              <Badge tone="neutral">{preview.unchanged} unchanged</Badge>
            </div>

            {preview.ignoredColumns && preview.ignoredColumns.length > 0 && (
              <Alert tone="neutral">
                These columns have no home in the tracker and will not be
                imported: {preview.ignoredColumns.join(", ")}.
              </Alert>
            )}

            {preview.errors && preview.errors.length > 0 && (
              <Alert>
                {preview.errors.length} row
                {preview.errors.length === 1 ? "" : "s"} could not be read and
                will be skipped: {preview.errors.slice(0, 3).join("; ")}
                {preview.errors.length > 3 ? "…" : ""}
              </Alert>
            )}

            <div className="max-h-[320px] overflow-y-auto rounded-md border border-line">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-muted text-xs uppercase tracking-wide text-fg-muted">
                  <tr>
                    <th className="px-sm py-xs text-left font-semibold">Row</th>
                    <th className="px-sm py-xs text-left font-semibold">
                      Client
                    </th>
                    <th className="px-sm py-xs text-left font-semibold">
                      Action
                    </th>
                    <th className="px-sm py-xs text-left font-semibold">
                      Changes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <PreviewLine
                      key={`${row.sheetRow}-${row.values.client}`}
                      row={row}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex justify-end gap-sm">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={commit}
            disabled={busy || !preview || willWrite === 0}
          >
            {willWrite === 0
              ? "Nothing to import"
              : `Import ${willWrite} row${willWrite === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PreviewLine({ row }: { row: PreviewRow }) {
  const tone =
    row.action === "create"
      ? "success"
      : row.action === "update"
        ? "warning"
        : "neutral";
  return (
    <tr className="border-t border-line">
      <td className="px-sm py-xs tabular-nums text-fg-muted">{row.sheetRow}</td>
      <td className="px-sm py-xs font-medium text-fg">
        {row.values.client}
        {/* A client can have several tracker rows once deals are linked, so
            naming the deal is what makes "will update" unambiguous. */}
        {row.matchedDeal && (
          <span className="block text-[11px] font-normal text-fg-subtle">
            → {row.matchedDeal}
          </span>
        )}
      </td>
      <td className="px-sm py-xs">
        <Badge tone={tone}>{row.action}</Badge>
      </td>
      <td className="px-sm py-xs text-fg-muted">
        {row.action === "update" ? (row.changes ?? []).join(", ") : "—"}
      </td>
    </tr>
  );
}
