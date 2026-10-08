import { apiFetch } from "../lib/api";

/** Mirrors implementation.Ask (services/internal/implementation/ask.go). */
export interface Ask {
  id: string;
  orgId: string;

  dealId: string | null;
  leadId: string | null;
  accountId: string | null;
  parentAskId: string | null;
  dealTitle: string | null;
  leadTitle: string | null;
  accountName: string | null;
  parentTitle?: string | null;
  /** Where the work happens — read live from the deal's sites (name, city). */
  locations?: string | null;
  /** The company pipeline this ask sits in, when one exists. */
  pipelineId?: string | null;

  subtaskCount?: number;
  subtaskDoneCount?: number;

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
  createdByRole?: string | null;

  dueAt: string | null;
  position: number;

  commentCount?: number;
  hasUnreadComments?: boolean;

  /** Set only on manager requests. */
  reviewStatus?: ReviewStatus | null;
  reviewNote?: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;

  deliveredAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors implementation.Pipeline — one company's kanban. */
export interface Pipeline {
  id: string;
  accountId: string;
  accountName: string;
  managerId: string | null;
  managerName: string | null;
  description: string;
  locations: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineInput {
  accountId: string;
  managerId?: string | null;
  description?: string;
}

/** Omitted fields are left as they are; managerId "" clears the manager. */
export interface PipelinePatch {
  managerId?: string;
  description?: string;
  archived?: boolean;
}

/** Roles that create, reassign and archive pipelines (mirrors the server). */
export const PIPELINE_ADMIN_ROLES = ["owner", "admin", "sales", "account_manager"];

/** Roles that may open the Engineer Tasks page: everyone who already sees all
 *  asks on the board, plus managers (who see their own team there). */
export const ENGINEER_TASKS_ROLES = [...PIPELINE_ADMIN_ROLES, "manager"];

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
    | "detached"
    | "comment_deleted"
    | "submitted"
    | "approved"
    | "rejected"
    | "deal_linked";
  field: string;
  fromValue: string;
  toValue: string;
  note: string;
  occurredAt: string;
}

export type ReviewStatus = "pending" | "approved" | "rejected";

/** Mirrors implementation.Comment. Deleted comments carry no content or author. */
export interface AskComment {
  id: string;
  askId: string;
  parentCommentId: string | null;
  authorId: string | null;
  authorName: string;
  authorRole: string;
  authorAvatarUrl: string | null;
  content: string;
  mentions: { userId: string; userName: string }[];
  editedAt: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommentPage {
  comments: AskComment[];
  nextCursor: string | null;
  totalCount: number;
}

export interface Mentionable {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
}

/** Roles that review manager requests (mirrors the server). */
export const REVIEWER_ROLES = PIPELINE_ADMIN_ROLES;

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
  accountId?: string;
  parentAskId?: string | null;
  title: string;
  type: string;
  detail: string;
  priority: AskPriority;
  assignedTo?: string;
  blockedReason?: string;
  /** ISO 8601, or omitted for no due date. */
  dueAt?: string | null;
}

export interface AskFilter {
  dealId?: string;
  leadId?: string;
  accountId?: string;
  parentAskId?: string;
  topLevelOnly?: boolean;
  status?: AskStatus;
  type?: string;
  assignedTo?: string;
  openOnly?: boolean;
  overdue?: boolean;
}

export interface EngineerWorkload {
  engineerId: string;
  engineerName: string;
  engineerEmail: string;
  activeTasks: Ask[];
  activeCount: number;
  blockedCount: number;
  doneCount: number;
}

export interface ManagerRoster {
  engineers: EngineerWorkload[];
  unassignedSubtasks: Ask[];
  managerTasks: Ask[];
}

const BASE = "/api/v1/implementation";

function query(filter: AskFilter): string {
  const params = new URLSearchParams();
  if (filter.dealId) params.set("dealId", filter.dealId);
  if (filter.leadId) params.set("leadId", filter.leadId);
  if (filter.accountId) params.set("accountId", filter.accountId);
  if (filter.parentAskId) params.set("parentAskId", filter.parentAskId);
  if (filter.topLevelOnly) params.set("topLevelOnly", "true");
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

  subtasks: (parentId: string) =>
    apiFetch<Ask[]>(`${BASE}/${parentId}/subtasks`),

  managerRoster: (managerId?: string) =>
    apiFetch<ManagerRoster>(`${BASE}/manager/roster${managerId ? `?managerId=${managerId}` : ""}`),

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

  pipelines: () => apiFetch<Pipeline[]>(`${BASE}/pipelines`),

  createPipeline: (input: PipelineInput) =>
    apiFetch<Pipeline>(`${BASE}/pipelines`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updatePipeline: (id: string, patch: PipelinePatch) =>
    apiFetch<Pipeline>(`${BASE}/pipelines/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

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

  comments: (id: string, cursor?: string) =>
    apiFetch<CommentPage>(
      `${BASE}/${id}/comments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),

  addComment: (id: string, content: string, parentCommentId?: string | null) =>
    apiFetch<AskComment>(`${BASE}/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ content, parentCommentId: parentCommentId ?? null }),
    }),

  editComment: (id: string, commentId: string, content: string) =>
    apiFetch<AskComment>(`${BASE}/${id}/comments/${commentId}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    }),

  deleteComment: (id: string, commentId: string) =>
    apiFetch<void>(`${BASE}/${id}/comments/${commentId}`, { method: "DELETE" }),

  mentionable: (id: string) => apiFetch<Mentionable[]>(`${BASE}/${id}/mentionable`),

  requests: (status: ReviewStatus = "pending") =>
    apiFetch<Ask[]>(`${BASE}/requests?status=${status}`),

  review: (id: string, action: "approve" | "reject", dealId?: string, note = "") =>
    apiFetch<Ask>(`${BASE}/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ action, dealId: dealId ?? null, note }),
    }),

  resubmit: (id: string) => apiFetch<Ask>(`${BASE}/${id}/resubmit`, { method: "POST" }),

  linkDeal: (id: string, dealId: string) =>
    apiFetch<Ask>(`${BASE}/${id}/link-deal`, {
      method: "POST",
      body: JSON.stringify({ dealId }),
    }),
};
