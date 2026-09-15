import { z } from "zod";

import { ACTION_STATUSES } from "./api";
import type { ActionUpdateInput } from "./api";

/**
 * Form contract for creating/editing an action. Status only appears when
 * editing — a new action always starts "open" (see ActionDialog).
 */
export const actionFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160, "160 characters or fewer"),
  // A native date input gives "" or YYYY-MM-DD.
  dueDate: z.string().min(1, "Due date is required"),
  assignedTo: z.string().optional(),
  accountId: z.string().optional(),
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  status: z.enum(ACTION_STATUSES),
});

export type ActionFormValues = z.infer<typeof actionFormSchema>;

/** Form values → API payload; empty strings are dropped rather than sent. */
export function toPayload(values: ActionFormValues): ActionUpdateInput {
  const text = (v?: string) => {
    const t = v?.trim();
    return t ? t : undefined;
  };

  return {
    title: values.title.trim(),
    // The server decodes this into a *time.Time, which only parses RFC3339 —
    // same suffix convention as the deal/quote/invoice date fields.
    dueAt: `${values.dueDate.trim()}T00:00:00Z`,
    status: values.status,
    assignedTo: text(values.assignedTo),
    accountId: text(values.accountId),
    leadId: text(values.leadId),
    dealId: text(values.dealId),
  };
}
