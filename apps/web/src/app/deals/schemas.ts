import { DEAL_STAGES } from "@go-crm/schemas";
import { z } from "zod";

import type { DealInput } from "./api";

/**
 * Form contract for creating/editing a deal. Mirrors the server's validation
 * (services/internal/deals/service.go) plus the coercions a DOM form needs.
 *
 * Unlike a lead, `amount` is required — it defaults to 0 rather than being
 * nullable, because a deal without a number attached is really still a lead.
 */
export const dealFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160, "160 characters or fewer"),
  description: z.string().trim().max(5000, "5000 characters or fewer").optional(),
  // Cleared number inputs yield "" or NaN; both mean zero here, not "unset".
  amount: z.preprocess(
    (v) => (v === "" || v === null || (typeof v === "number" && Number.isNaN(v)) ? 0 : v),
    z.number({ invalid_type_error: "Enter a number" }).nonnegative("Must be 0 or more"),
  ),
  stage: z.enum(DEAL_STAGES),
  ownerUserId: z.string().optional(),
  contactId: z.string().optional(),
  // A native date input gives "" or YYYY-MM-DD.
  expectedCloseDate: z.string().optional(),
});

export type DealFormValues = z.infer<typeof dealFormSchema>;

/** Form values → API payload; empty strings are dropped rather than sent. */
export function toPayload(values: DealFormValues): DealInput {
  const text = (v?: string) => {
    const t = v?.trim();
    return t ? t : undefined;
  };

  return {
    title: values.title.trim(),
    description: text(values.description),
    amount: values.amount,
    stage: values.stage,
    ownerUserId: text(values.ownerUserId),
    contactId: text(values.contactId),
    expectedCloseDate: text(values.expectedCloseDate),
  };
}
