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
