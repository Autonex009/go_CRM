import { contactSchema } from "@go-crm/schemas";
import type { z } from "zod";

/**
 * Create-contact form contract. Reuses the shared contact rules (which mirror
 * the backend's own validation) minus the fields the form doesn't collect:
 * `id` is server-assigned, and `accountId` waits for an accounts UI.
 *
 * The gateway rejects unknown JSON fields, so this omission is also what keeps
 * the request body valid.
 */
export const newContactSchema = contactSchema.omit({ id: true, accountId: true });

export type NewContactInput = z.infer<typeof newContactSchema>;
