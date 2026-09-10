import { apiFetch } from "../lib/api";

/** Mirrors delivery.Row (services/internal/delivery/service.go). */
export interface TrackerRow {
  id: string;
  client: string;
  products: string | null;
  locations: string | null;
  totalCameras: number | null;
  status: string | null;
  /** DATE column, so only the first 10 characters are meaningful. */
  implementationDate: string | null;
  currentStages: string | null;
  keyContacts: string | null;
  nextSteps: string | null;
  notes: string | null;
  position: number;
  /**
   * The deal this row is delivering, denormalized by the server. Null for rows
   * typed or imported before any deal existed.
   */
  dealId: string | null;
  dealTitle: string | null;
  dealStage: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors delivery.Input — the writable half of a row. */
export interface TrackerInput {
  client: string;
  products: string | null;
  locations: string | null;
  totalCameras: number | null;
  status: string | null;
  implementationDate: string | null;
  currentStages: string | null;
  keyContacts: string | null;
  nextSteps: string | null;
  notes: string | null;
}

export interface TrackerPage {
  items: TrackerRow[];
  total: number;
}

/** What committing one parsed sheet line would do. Mirrors delivery.PreviewRow. */
export interface PreviewRow {
  sheetRow: number;
  action: "create" | "update" | "unchanged";
  values: TrackerInput;
  existingId: string | null;
  /** The deal behind the matched row, when it has one. */
  matchedDeal: string | null;
  changes: string[] | null;
}

/** Mirrors delivery.Preview. */
export interface ImportPreview {
  rows: PreviewRow[];
  errors: string[] | null;
  ignoredColumns: string[] | null;
  created: number;
  updated: number;
  unchanged: number;
}

export interface CommitResult {
  created: number;
  updated: number;
}

/**
 * The stages a delivery can be at, taken verbatim from the data validation on
 * the "Current Stage(s)" column of the Master Tracker sheet this table replaced.
 *
 * In the sheet's order rather than alphabetised: it is a pipeline, and reading
 * it in sequence is the point. Rows imported while the column was still free
 * text can hold a value that is not on this list; TrackerCell keeps such a value
 * selectable so that editing the row cannot quietly rewrite it.
 */
export const DELIVERY_STAGE_OPTIONS = [
  "Lead / Intro Call",
  "Use Case Discussion",
  "NDA / Demo",
  "Quotation Sent",
  "PoC",
  "Deployment",
  "Deployed / Live",
] as const;

/**
 * Cell colours for the stage dropdown, matching the conditional formatting the
 * sheet used: warm while the deal is still being talked about, green once it is
 * being installed. Colour is what makes a stage column readable at a glance
 * down a long table, which is the whole reason the sheet had it.
 */
export const DELIVERY_STAGE_COLORS: Record<string, string> = {
  "Lead / Intro Call": "bg-slate-100 text-slate-800",
  "Use Case Discussion": "bg-sky-100 text-sky-900",
  "NDA / Demo": "bg-indigo-100 text-indigo-900",
  "Quotation Sent": "bg-amber-100 text-amber-900",
  PoC: "bg-orange-100 text-orange-900",
  Deployment: "bg-emerald-100 text-emerald-900",
  "Deployed / Live": "bg-green-200 text-green-900",
};

/**
 * The tracker's editable columns, in table order. One list drives the header,
 * the cells and the CSV export, so a new column cannot appear in one and not
 * the others.
 */
export const TRACKER_COLUMNS = [
  { key: "client", label: "Client", type: "text", width: "min-w-[180px]" },
  {
    key: "products",
    label: "Product(s)",
    type: "text",
    width: "min-w-[160px]",
    syncedWithDeal: true,
  },
  {
    key: "locations",
    label: "Key Location(s)",
    type: "text",
    width: "min-w-[180px]",
    syncedWithDeal: true,
  },
  {
    key: "totalCameras",
    label: "Total Cameras",
    type: "number",
    width: "min-w-[110px]",
    syncedWithDeal: true,
  },
  { key: "status", label: "Status", type: "text", width: "min-w-[140px]" },
  {
    key: "implementationDate",
    label: "Implementation Date",
    type: "date",
    width: "min-w-[150px]",
  },
  {
    key: "currentStages",
    label: "Current Stage(s)",
    type: "select",
    width: "min-w-[160px]",
    options: DELIVERY_STAGE_OPTIONS,
  },
  {
    key: "keyContacts",
    label: "Key Contacts",
    type: "text",
    width: "min-w-[160px]",
  },
  {
    key: "nextSteps",
    label: "Next Steps",
    type: "text",
    width: "min-w-[180px]",
  },
  { key: "notes", label: "Notes", type: "text", width: "min-w-[200px]" },
] as const satisfies readonly {
  key: keyof TrackerInput;
  label: string;
  type: "text" | "number" | "date" | "select";
  width: string;
  /** The choices offered by a `select` column. */
  options?: readonly string[];
  /**
   * Also stored on the linked deal. Editing either side writes both, so
   * these are flagged in the header rather than locked — the point of the
   * link is being able to fix a camera count wherever you are looking.
   */
  syncedWithDeal?: boolean;
}[];

export type TrackerColumn = (typeof TRACKER_COLUMNS)[number];
export type TrackerField = TrackerColumn["key"];

/**
 * One column of the rendered grid: either an editable field or the read-only
 * deal the row is delivering.
 *
 * The grid has one more column than the row has fields, and the header and the
 * body used to each work that out for themselves — the body injected a deal cell
 * after Client and the header did not, so every heading from Product(s) rightward
 * sat one column left of its data and the Notes value landed under the delete
 * button. Both now walk this list, so the two cannot disagree about how many
 * cells a row has.
 *
 * `fieldIndex` is the position within TRACKER_COLUMNS, kept separate from the
 * grid position because keyboard navigation addresses editable cells only.
 */
export type GridColumn =
  | { kind: "field"; column: TrackerColumn; fieldIndex: number }
  | { kind: "deal"; label: string; width: string };

export const GRID_COLUMNS: readonly GridColumn[] = TRACKER_COLUMNS.flatMap(
  (column, fieldIndex): GridColumn[] => {
    const field: GridColumn = { kind: "field", column, fieldIndex };
    // The deal sits immediately after the client: the two together are what
    // identifies a line, and pushing it to the far right would put it past the
    // horizontal scroll on a ten-column sheet.
    return fieldIndex === 0
      ? [field, { kind: "deal", label: "Deal", width: "min-w-[160px]" }]
      : [field];
  },
);

/** An empty row, for the "add row" affordance at the bottom of the table. */
export function blankRow(): TrackerInput {
  return {
    client: "",
    products: null,
    locations: null,
    totalCameras: null,
    status: null,
    implementationDate: null,
    currentStages: null,
    keyContacts: null,
    nextSteps: null,
    notes: null,
  };
}

/** Strips a row down to the fields the server accepts on write. */
export function toInput(row: TrackerRow | TrackerInput): TrackerInput {
  return {
    client: row.client,
    products: row.products,
    locations: row.locations,
    totalCameras: row.totalCameras,
    // A DATE round-trips as a full timestamp; the input needs YYYY-MM-DD.
    implementationDate: row.implementationDate?.slice(0, 10) ?? null,
    status: row.status,
    currentStages: row.currentStages,
    keyContacts: row.keyContacts,
    nextSteps: row.nextSteps,
    notes: row.notes,
  };
}

const BASE = "/api/v1/delivery";

export const deliveryApi = {
  list: () => apiFetch<TrackerPage>(BASE),

  create: (input: TrackerInput) =>
    apiFetch<TrackerRow>(BASE, { method: "POST", body: JSON.stringify(input) }),

  update: (id: string, input: TrackerInput) =>
    apiFetch<TrackerRow>(`${BASE}/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),

  reorder: (ids: string[]) =>
    apiFetch<void>(`${BASE}/reorder`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  /** Uploads a sheet and reports what committing it would do. Writes nothing. */
  previewImport: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<ImportPreview>(`${BASE}/import/preview`, {
      method: "POST",
      body: form,
    });
  },

  /** Applies rows the user accepted in the preview. */
  commitImport: (rows: TrackerInput[]) =>
    apiFetch<CommitResult>(`${BASE}/import/commit`, {
      method: "POST",
      body: JSON.stringify({ rows }),
    }),
};
