import { z } from "zod";

/**
 * Zod schemas shared between web and mobile (forms, API payloads).
 * Fully aligned with the crm_portal database schema and contracts.
 */

export const USER_ROLES = ["owner", "admin", "sales", "account_manager", "client"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "replied",
  "call_booked",
  "call_done",
  "converted",
  "dropped",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const DEAL_STAGES = [
  "prospect",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const QUOTE_STATUSES = ["draft", "sent", "approved", "rejected", "expired"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const ACTIVITY_TYPES = ["note", "call", "email", "meeting", "system"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Company (Account) schema matching crm_portal */
export const companySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  domain: z.string().max(255).nullable().optional(),
  industry: z.string().max(255).nullable().optional(),
  city: z.string().max(255).nullable().optional(),
  website: z.string().max(255).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  source: z.string().max(255).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  logoPath: z.string().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  ownerUserId: z.string().uuid().nullable().optional(), // alias
});
export type Company = z.infer<typeof companySchema>;

// Alias for account backwards compatibility
export const accountSchema = companySchema;
export type Account = Company;

/** Contact schema matching crm_portal */
export const contactSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(), // alias
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  title: z.string().max(100).nullable().optional(),
});
export type Contact = z.infer<typeof contactSchema>;

/** Lead schema matching crm_portal */
export const leadSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().max(255).nullable().optional(),
  contactName: z.string().max(255).nullable().optional(),
  jobTitle: z.string().max(255).nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
  contactId: z.string().uuid().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  industry: z.string().max(255).nullable().optional(),
  location: z.string().max(255).nullable().optional(),
  productInterest: z.string().max(255).nullable().optional(),
  source: z.string().max(255).nullable().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  stage: z.enum(LEAD_STATUSES).optional(), // alias
  assignedTo: z.string().uuid().nullable().optional(),
  ownerUserId: z.string().uuid().nullable().optional(), // alias
  valueEstimate: z.number().nonnegative().nullable().optional(),
  value: z.number().nonnegative().nullable().optional(), // alias
  nextFollowUpDate: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});
export type Lead = z.infer<typeof leadSchema>;
export type LeadStage = LeadStatus;

/** Deal schema matching crm_portal */
export const dealSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  jobTitle: z.string().max(255).nullable().optional(),
  companyId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(), // alias
  primaryContactId: z.string().uuid().nullable().optional(),
  contactId: z.string().uuid().nullable().optional(), // alias
  leadId: z.string().uuid().nullable().optional(),
  stage: z.enum(DEAL_STAGES),
  amount: z.number().nonnegative(),
  productUseCase: z.string().nullable().optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  nextAction: z.string().nullable().optional(),
  siteAssessmentDate: z.string().nullable().optional(),
  siteAssessmentLocation: z.string().nullable().optional(),
  siteAssessmentNotes: z.string().nullable().optional(),
  lostReason: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  ownerId: z.string().uuid().optional(),
  ownerUserId: z.string().uuid().optional(), // alias
  expectedCloseDate: z.string().nullable().optional(),
});
export type Deal = z.infer<typeof dealSchema>;

/** Login schema */
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;
