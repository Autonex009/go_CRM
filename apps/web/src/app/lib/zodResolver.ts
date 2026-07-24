import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { ZodTypeAny } from "zod";

/**
 * Minimal react-hook-form resolver for a zod schema. Lets us reuse the shared
 * @go-crm/schemas contracts for form validation without pulling in the full
 * @hookform/resolvers package.
 */
export function zodResolver<T extends FieldValues>(schema: ZodTypeAny): Resolver<T> {
  return async (values) => {
    const parsed = schema.safeParse(values);
    if (parsed.success) {
      return { values: parsed.data as T, errors: {} };
    }

    const errors: FieldErrors<T> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      // Keep the first error per field, matching RHF's default behaviour.
      if (typeof key === "string" && !(key in errors)) {
        (errors as Record<string, unknown>)[key] = {
          type: issue.code,
          message: issue.message,
        };
      }
    }
    return { values: {}, errors };
  };
}
