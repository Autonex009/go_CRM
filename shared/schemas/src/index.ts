import { z } from "zod";

/**
 * Zod schemas shared between web and mobile (forms, API payloads).
 * Mirror the backend domain contracts here.
 */

/**
 * An "account" is a company the tenant sells to — not the tenant itself, which is
 * an organization. Only the name is required; the rest is filled in as you learn
 * about the company.
 */
export const accountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  website: z.string().max(255).optional(),
  industry: z.string().max(80).optional(),
  phone: z.string().max(40).optional(),
  notes: z.string().max(5000).optional(),
  ownerUserId: z.string().uuid().optional(),
});
export type Account = z.infer<typeof accountSchema>;

/**
 * Only the first name is required. Surname and email became optional in
 * migration 000006 so a lead — which only requires a first name — can be
 * converted into a contact; mononyms and phone-only contacts are also just real.
 */
export const contactSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  accountId: z.string().uuid().optional(),
});
export type Contact = z.infer<typeof contactSchema>;

/**
 * The deal lifecycle, in pipeline order. Deliberately shorter than LEAD_STAGES —
 * a deal has no "contacted" step. Must stay in sync with
 * services/internal/deals/service.go (Stages) and the CHECK constraint in
 * migration 000005.
 */
export const DEAL_STAGES = ["lead", "qualified", "proposal", "won", "lost"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const dealSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(160),
  description: z.string().max(5000).optional(),
  amount: z.number().nonnegative(),
  stage: z.enum(DEAL_STAGES),
  ownerUserId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  expectedCloseDate: z.string().optional(),
  accountId: z.string().uuid().optional(),
});
export type Deal = z.infer<typeof dealSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * The lead lifecycle, in pipeline order. Must stay in sync with
 * services/internal/leads/service.go (Stages) and the CHECK constraint in
 * migration 000004 — the board columns are generated from this.
 */
export const LEAD_STAGES = ["new", "contacted", "qualified", "proposal", "won", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const leadSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  company: z.string().max(120).optional(),
  source: z.string().max(60).optional(),
  notes: z.string().max(5000).optional(),
  value: z.number().nonnegative().optional(),
  stage: z.enum(LEAD_STAGES),
  ownerUserId: z.string().uuid().optional(),
});
export type Lead = z.infer<typeof leadSchema>;
