import { z } from "zod";

/**
 * Zod schemas shared between web and mobile (forms, API payloads).
 * Mirror the backend domain contracts here.
 */

export const contactSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  accountId: z.string().uuid().optional(),
});
export type Contact = z.infer<typeof contactSchema>;

export const dealSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  amount: z.number().nonnegative(),
  stage: z.enum(["lead", "qualified", "proposal", "won", "lost"]),
  accountId: z.string().uuid(),
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
