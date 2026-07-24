import { loginSchema } from "@go-crm/schemas";
import { z } from "zod";

/**
 * Registration form contract. Reuses the shared email/password rules (which
 * mirror the backend) and adds a client-only password confirmation.
 */
export const registerSchema = loginSchema
  .extend({
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
