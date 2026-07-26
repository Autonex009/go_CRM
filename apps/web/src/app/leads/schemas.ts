import { LEAD_STAGES } from "@go-crm/schemas";
import { z } from "zod";

import type { LeadInput } from "./api";

/**
 * Form contract for creating/editing a lead. Mirrors the server's validation
 * (services/internal/leads/service.go) but adds the coercions a DOM form needs:
 * every input yields a string, and "empty" has to mean "not provided".
 *
 * Deliberately permissive — only a name and a stage are required, because a
 * lead is incomplete information by definition. Demanding an email up front
 * just teaches people to type junk.
 */
export const leadFormSchema = z.object({
  firstName: z.string().trim().min(1, "Name is required").max(100, "100 characters or fewer"),
  lastName: z.string().trim().max(100, "100 characters or fewer").optional(),
  // Blank is fine; anything else has to look like an address.
  email: z.union([z.literal(""), z.string().email("Enter a valid email")]).optional(),
  phone: z.string().trim().max(40, "40 characters or fewer").optional(),
  company: z.string().trim().max(120, "120 characters or fewer").optional(),
  source: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(5000, "5000 characters or fewer").optional(),
  // A number input gives "" when cleared and NaN via valueAsNumber; both mean
  // "no estimate", not "zero".
  value: z.preprocess(
    (v) => (v === "" || v === null || (typeof v === "number" && Number.isNaN(v)) ? undefined : v),
    z.number({ invalid_type_error: "Enter a number" }).nonnegative("Must be 0 or more").optional(),
  ),
  stage: z.enum(LEAD_STAGES),
  ownerUserId: z.string().optional(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

/**
 * Form values → API payload. Empty strings are dropped rather than sent: the
 * gateway would store them as NULL anyway, and omitting them keeps the request
 * to exactly the fields the user filled in.
 */
export function toPayload(values: LeadFormValues): LeadInput {
  const text = (v?: string) => {
    const t = v?.trim();
    return t ? t : undefined;
  };

  return {
    firstName: values.firstName.trim(),
    lastName: text(values.lastName),
    email: text(values.email),
    phone: text(values.phone),
    company: text(values.company),
    source: text(values.source),
    notes: text(values.notes),
    value: values.value,
    stage: values.stage,
    ownerUserId: text(values.ownerUserId),
  };
}
