import { z } from "zod";

import { LEAD_STAGES, type LeadInput } from "./api";

/**
 * Form contract for a lead. Mirrors the server's validation
 * (services/internal/leads/service.go) plus the coercions a DOM form needs.
 *
 * Deliberately permissive — only a name is required, because a lead is
 * incomplete information by definition. Demanding an email up front just teaches
 * people to type junk.
 */
export const leadFormSchema = z.object({
  firstName: z.string().trim().min(1, "Name is required").max(100, "100 characters or fewer"),
  lastName: z.string().trim().max(100, "100 characters or fewer").optional(),
  title: z.string().trim().max(120, "120 characters or fewer").optional(),
  // Blank is fine; anything else has to look like an address.
  email: z.union([z.literal(""), z.string().email("Enter a valid email")]).optional(),
  phone: z.string().trim().max(40, "40 characters or fewer").optional(),
  // Not validated as a URL: the server accepts a bare domain and adds the
  // scheme, so rejecting "linkedin.com/in/x" here would be stricter than the API.
  linkedinUrl: z.string().trim().max(255, "255 characters or fewer").optional(),
  accountId: z.string().optional(),
  company: z.string().trim().max(160, "160 characters or fewer").optional(),
  source: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(5000, "5000 characters or fewer").optional(),
  // A cleared number input gives "" or NaN; both mean "no estimate", not zero.
  value: z.preprocess(
    (v) => (v === "" || v === null || (typeof v === "number" && Number.isNaN(v)) ? undefined : v),
    z.number({ invalid_type_error: "Enter a number" }).nonnegative("Must be 0 or more").optional(),
  ),
  stage: z.enum(LEAD_STAGES),
  ownerUserId: z.string().optional(),
  followUpAt: z.string().optional(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

/** Form values → API payload; empty strings are dropped rather than sent. */
export function toPayload(values: LeadFormValues): LeadInput {
  const text = (v?: string) => {
    const t = v?.trim();
    return t ? t : undefined;
  };

  return {
    firstName: values.firstName.trim(),
    lastName: text(values.lastName),
    title: text(values.title),
    email: text(values.email),
    phone: text(values.phone),
    linkedinUrl: text(values.linkedinUrl),
    accountId: text(values.accountId),
    company: text(values.company),
    source: text(values.source),
    notes: text(values.notes),
    value: values.value,
    stage: values.stage,
    ownerUserId: text(values.ownerUserId),
    followUpAt: values.followUpAt ? `${values.followUpAt}T00:00:00Z` : undefined,
  };
}
