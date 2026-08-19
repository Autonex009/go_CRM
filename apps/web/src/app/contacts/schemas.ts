import { contactSchema } from "@go-crm/schemas";
import type { z } from "zod";

/**
 * Create-contact form contract. Reuses the shared contact rules (which mirror the
 * backend's own validation) minus `id`, which is server-assigned.
 *
 * `accountId` is now collected — the accounts module (§22) gives it something to
 * point at. The gateway rejects unknown JSON fields, so this set has to match the
 * writable shape exactly.
 */
export const newContactSchema = contactSchema.omit({ id: true });

export type NewContactInput = z.infer<typeof newContactSchema>;
