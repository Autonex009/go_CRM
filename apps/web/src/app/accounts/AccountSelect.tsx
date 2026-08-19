import { useQuery } from "@tanstack/react-query";
import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";

import { SelectField } from "../ui";
import { accountsApi } from "./api";

/**
 * Account picker, shared by the contact and deal dialogs so neither has to know
 * how accounts are fetched.
 *
 * One query key (`accountOptions`) for both, cached for 5 minutes: companies
 * change far less often than the records that point at them, and both dialogs
 * open repeatedly during normal use.
 *
 * Caveat: this lists the first 100 accounts. Past that it needs to become a
 * typeahead against a search endpoint — noted in EXPLAINER §22.5 rather than
 * pretending a dropdown scales.
 */
export const AccountSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
}>(function AccountSelect({ label = "Company", error, ...props }, ref) {
  const accounts = useQuery({
    queryKey: ["accountOptions"],
    queryFn: () => accountsApi.list(0, 100),
    staleTime: 5 * 60_000,
  });

  return (
    <SelectField label={label} error={error} ref={ref} {...props}>
      <option value="">—</option>
      {(accounts.data?.items ?? []).map((account) => (
        <option key={account.id} value={account.id}>
          {account.name}
        </option>
      ))}
    </SelectField>
  );
});
