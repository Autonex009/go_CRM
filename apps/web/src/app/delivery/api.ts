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
 * The tracker's editable columns, in table order. One list drives the header,
 * the cells and the CSV export, so a new column cannot appear in one and not
 * the others.
 */
export const TRACKER_COLUMNS = [
  { key: "client", label: "Client", type: "text", width: "min-w-[180px]" },
  { key: "products", label: "Product(s)", type: "text", width: "min-w-[160px]" },
  { key: "locations", label: "Key Location(s)", type: "text", width: "min-w-[180px]" },
  { key: "totalCameras", label: "Total Cameras", type: "number", width: "min-w-[110px]" },
  { key: "status", label: "Status", type: "text", width: "min-w-[140px]" },
  { key: "implementationDate", label: "Implementation Date", type: "date", width: "min-w-[150px]" },
  { key: "currentStages", label: "Current Stage(s)", type: "text", width: "min-w-[160px]" },
  { key: "keyContacts", label: "Key Contacts", type: "text", width: "min-w-[160px]" },
  { key: "nextSteps", label: "Next Steps", type: "text", width: "min-w-[180px]" },
  { key: "notes", label: "Notes", type: "text", width: "min-w-[200px]" },
] as const satisfies readonly {
  key: keyof TrackerInput;
  label: string;
  type: "text" | "number" | "date";
  width: string;
}[];

export type TrackerColumn = (typeof TRACKER_COLUMNS)[number];
export type TrackerField = TrackerColumn["key"];

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
    apiFetch<TrackerRow>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(input) }),

  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),

  reorder: (ids: string[]) =>
    apiFetch<void>(`${BASE}/reorder`, { method: "POST", body: JSON.stringify({ ids }) }),

  /** Uploads a sheet and reports what committing it would do. Writes nothing. */
  previewImport: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<ImportPreview>(`${BASE}/import/preview`, { method: "POST", body: form });
  },

  /** Applies rows the user accepted in the preview. */
  commitImport: (rows: TrackerInput[]) =>
    apiFetch<CommitResult>(`${BASE}/import/commit`, {
      method: "POST",
      body: JSON.stringify({ rows }),
    }),
};
