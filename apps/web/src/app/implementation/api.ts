import { apiFetch } from "../lib/api";

/** Mirrors implementation.Ask (services/internal/implementation/ask.go). */
export interface Ask {
  id: string;
  orgId: string;

  dealId: string | null;
  leadId: string | null;
  accountId: string | null;
  dealTitle: string | null;
  leadTitle: string | null;
  accountName: string | null;

  title: string;
  type: string;
  detail: string;
  priority: AskPriority;
  status: AskStatus;
  blockedReason: string;

  assignedTo: string | null;
  assignedToName: string | null;
  createdBy: string | null;
  createdByName: string | null;

  dueAt: string | null;
  position: number;

  deliveredAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const ASK_STATUSES = [
  "requested",
  "acknowledged",
  "in_progress",
  "blocked",
  "delivered",
  "verified",
  "wont_do",
] as const;
export type AskStatus = (typeof ASK_STATUSES)[number];

export const ASK_PRIORITIES = ["p0", "p1", "p2"] as const;
export type AskPriority = (typeof ASK_PRIORITIES)[number];

/** Mirrors implementation.Event — one line of an ask's history. */
export interface AskEvent {
  id: string;
  askId: string;
  actorId: string | null;
  actorName: string | null;
  kind:
    | "created"
    | "status_changed"
    | "assigned"
    | "priority_changed"
    | "due_changed"
    | "edited"
    | "blocked"
    | "attached"
    | "detached";
  field: string;
  fromValue: string;
  toValue: string;
  note: string;
  occurredAt: string;
}

/** Mirrors implementation.Attachment. */
export interface Attachment {
  id: string;
  askId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  uploadedByName: string | null;
  createdAt: string;
}

/** Mirrors implementation.AskType — one entry in the workspace's type list. */
export interface AskType {
  id: string;
  name: string;
  createdAt: string;
  /** How many asks carry this type, so the UI can warn before removing it. */
  inUse: number;
}

export interface Counts {
  open: number;
  blocked: number;
  overdue: number;
  mine: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

export interface Board {
  statuses: AskStatus[];
  asks: Ask[];
  counts: Counts;
  /** Types already used here. Suggestions, not a fixed list. */
  types: string[];
}

export interface AskInput {
  dealId?: string;
  leadId?: string;
  title: string;
  type: string;
  detail: string;
  priority: AskPriority;
  assignedTo?: string;
  /** ISO 8601, or omitted for no due date. */
  dueAt?: string | null;
}

export interface AskFilter {
  dealId?: string;
  leadId?: string;
  accountId?: string;
  status?: AskStatus;
  type?: string;
  assignedTo?: string;
  openOnly?: boolean;
  overdue?: boolean;
}

const BASE = "/api/v1/implementation";

function query(filter: AskFilter): string {
  const params = new URLSearchParams();
  if (filter.dealId) params.set("dealId", filter.dealId);
  if (filter.leadId) params.set("leadId", filter.leadId);
  if (filter.accountId) params.set("accountId", filter.accountId);
  if (filter.status) params.set("status", filter.status);
  if (filter.type) params.set("type", filter.type);
  if (filter.assignedTo) params.set("assignedTo", filter.assignedTo);
  if (filter.openOnly) params.set("openOnly", "true");
  if (filter.overdue) params.set("overdue", "true");
  const s = params.toString();
  return s ? `?${s}` : "";
}

export const implementationApi = {
  board: (filter: AskFilter = {}) =>
    apiFetch<Board>(`${BASE}${query(filter)}`),

  get: (id: string) => apiFetch<Ask>(`${BASE}/${id}`),

  create: (input: AskInput) =>
    apiFetch<Ask>(BASE, { method: "POST", body: JSON.stringify(input) }),

  update: (id: string, input: AskInput) =>
    apiFetch<Ask>(`${BASE}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  move: (id: string, status: AskStatus, reason = "") =>
    apiFetch<Ask>(`${BASE}/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ status, reason }),
    }),

  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),

  events: (id: string) => apiFetch<AskEvent[]>(`${BASE}/${id}/events`),

  types: () => apiFetch<AskType[]>(`${BASE}/types`),

  createType: (name: string) =>
    apiFetch<AskType>(`${BASE}/types`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  deleteType: (id: string) =>
    apiFetch<void>(`${BASE}/types/${id}`, { method: "DELETE" }),

  attachments: (id: string) =>
    apiFetch<Attachment[]>(`${BASE}/${id}/attachments`),

  /** Returns a short-lived URL for the browser to open. */
  attachmentUrl: (id: string, attachmentId: string) =>
    apiFetch<{ url: string }>(`${BASE}/${id}/attachments/${attachmentId}`),

  rename: (id: string, attachmentId: string, fileName: string) =>
    apiFetch<Attachment>(`${BASE}/${id}/attachments/${attachmentId}`, {
      method: "PATCH",
      body: JSON.stringify({ fileName }),
    }),

  detach: (id: string, attachmentId: string) =>
    apiFetch<void>(`${BASE}/${id}/attachments/${attachmentId}`, {
      method: "DELETE",
    }),
};
