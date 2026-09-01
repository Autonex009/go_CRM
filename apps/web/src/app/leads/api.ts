import { apiFetch } from "../lib/api";
import type { IconName, Tone } from "../ui";

/**
 * The lead lifecycle, per the redesign brief §3.2. Outreach only — a lead hands
 * off to a deal rather than closing, which is why "proposal sent" and "closed"
 * live in the deal pipeline.
 */
export const LEAD_STAGES = [
  "new",
  "initial count",
  "deck sent",
  "call scheduled",
  "call done",
  "proposal sent",
  "closed",
  "not interested",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

/** Stages where the work has finished, one way or the other. */
export const TERMINAL_STAGES: LeadStage[] = ["closed", "not interested"];

/** The stages that form the funnel strip; the two terminal ones sit outside it. */
export const FUNNEL_STAGES: LeadStage[] = [
  "new",
  "initial count",
  "deck sent",
  "call scheduled",
  "call done",
  "proposal sent",
];

/** Mirrors leads.Lead. */
export interface Lead {
  id: string;
  firstName: string;
  lastName: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  source: string | null;
  notes: string | null;
  value: number | null;
  stage: LeadStage;

  accountId: string | null;
  accountName: string | null;
  accountIndustry: string | null;
  /** Free-text fallback for a lead captured before the company record existed. */
  company: string | null;

  contactId: string | null;

  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;

  followUpAt: string | null;
  /** Derived by the server, not stored. */
  overdue: boolean;
  dueToday: boolean;
  /** Most recent thing a person logged — the brief's "date of contact". */
  lastContactedAt: string | null;

  convertedAt: string | null;
  convertedDealId: string | null;
  convertedContactId: string | null;

  createdAt: string;
  updatedAt: string;
}

/** Mirrors leads.Page — the list plus the counts the funnel and pills need. */
export interface LeadPage {
  items: Lead[];
  total: number;
  limit: number;
  offset: number;
  counts: Record<string, number>;
  stages: LeadStage[];
}

export interface LeadInput {
  firstName: string;
  lastName?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  company?: string;
  accountId?: string;
  contactId?: string;
  source?: string;
  notes?: string;
  value?: number;
  stage: LeadStage;
  ownerUserId?: string;
  followUpAt?: string;
}

/** One step along the lifecycle, optionally rescheduling the next touch. */
export interface AdvanceInput {
  toStage: LeadStage;
  followUpAt?: string;
  clearFollowUp?: boolean;
  note?: string;
}

/** The convert dialog's payload (brief §3.4). */
export interface ConvertInput {
  dealTitle?: string;
  amount?: number;
  expectedCloseDate?: string;
  callNotes?: string;
  dealStage?: string;
}

export interface Conversion {
  leadId: string;
  contactId: string;
  dealId: string;
  accountId: string;
  contactCreated: boolean;
}

export const PAGE_SIZE = 25;

const BASE = "/api/v1/leads";

export const leadsApi = {
  /** `filter` accepts a stage, or the derived views: overdue / due_today / open. */
  list: (offset = 0, filter = "") =>
    apiFetch<LeadPage>(
      `${BASE}?limit=${PAGE_SIZE}&offset=${offset}${filter ? `&filter=${filter}` : ""}`,
    ),

  get: (id: string) => apiFetch<Lead>(`${BASE}/${id}`),

  create: (input: LeadInput) =>
    apiFetch<Lead>(BASE, { method: "POST", body: JSON.stringify(input) }),

  update: (id: string, input: LeadInput) =>
    apiFetch<Lead>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(input) }),

  advance: (id: string, input: AdvanceInput) =>
    apiFetch<Lead>(`${BASE}/${id}/advance`, { method: "POST", body: JSON.stringify(input) }),

  convert: (id: string, input: ConvertInput = {}) =>
    apiFetch<Conversion>(`${BASE}/${id}/convert`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),
};

interface StageMeta {
  label: string;
  tone: Tone;
  /** Fill colour for the dashboard funnel bar. */
  bar: string;
}

export const STAGE_META: Record<LeadStage, StageMeta> = {
  "new": { label: "New", tone: "neutral", bar: "bg-neutral-300" },
  "initial count": { label: "Initial count", tone: "info", bar: "bg-info-500" },
  "deck sent": { label: "Deck sent", tone: "brand", bar: "bg-brand-500" },
  "call scheduled": { label: "Call scheduled", tone: "warning", bar: "bg-warning-500" },
  "call done": { label: "Call done", tone: "success", bar: "bg-success-500" },
  "proposal sent": { label: "Proposal sent", tone: "success", bar: "bg-success-600" },
  "closed": { label: "Closed", tone: "success", bar: "bg-success-600" },
  "not interested": { label: "Not interested", tone: "danger", bar: "bg-danger-500" },
};

export function stageLabel(stage: string): string {
  return STAGE_META[stage as LeadStage]?.label ?? stage;
}

/**
 * The brief's contextual Action column: one obvious next step per stage.
 *
 * `needsDate` marks the action that schedules something — booking a call has to
 * ask *when*, or the follow-up column stays empty and the lead falls out of the
 * urgency sort entirely.
 */
interface NextAction {
  label: string;
  toStage: LeadStage;
  icon: IconName;
  needsDate?: boolean;
  /** Opens the convert dialog instead of advancing a stage. */
  convert?: boolean;
}

export const NEXT_ACTION: Partial<Record<LeadStage, NextAction>> = {
  "new": { label: "Log initial count", toStage: "initial count", icon: "mail" },
  "initial count": { label: "Send deck", toStage: "deck sent", icon: "mail" },
  "deck sent": { label: "Schedule call", toStage: "call scheduled", icon: "phone", needsDate: true },
  "call scheduled": { label: "Mark call done", toStage: "call done", icon: "check" },
  "call done": { label: "Send proposal", toStage: "proposal sent", icon: "mail" },
  "proposal sent": { label: "Mark closed", toStage: "closed", icon: "check" },
};

/** "3 days overdue" / "Due tomorrow" — the follow-up column's wording. */
export function followUpLabel(lead: Lead): { text: string; tone: "overdue" | "due" | "plain" } {
  if (!lead.followUpAt) return { text: "—", tone: "plain" };

  const due = new Date(lead.followUpAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const finished = TERMINAL_STAGES.includes(lead.stage as LeadStage);

  if (days < 0) {
    const n = Math.abs(days);
    return {
      text: `${n} day${n === 1 ? "" : "s"} overdue`,
      tone: finished ? "plain" : "overdue",
    };
  }
  if (days === 0) return { text: "Due today", tone: finished ? "plain" : "due" };
  if (days === 1) return { text: "Due tomorrow", tone: "plain" };
  return { text: due.toLocaleDateString(undefined, { day: "numeric", month: "short" }), tone: "plain" };
}

/** "Ada Lovelace", or just the first name when there's no surname. */
export function leadName(lead: Pick<Lead, "firstName" | "lastName">): string {
  return lead.lastName ? `${lead.firstName} ${lead.lastName}` : lead.firstName;
}

/** The company to show: the linked account, else the free text. */
export function leadCompany(lead: Pick<Lead, "accountName" | "company">): string | null {
  return lead.accountName ?? lead.company;
}
