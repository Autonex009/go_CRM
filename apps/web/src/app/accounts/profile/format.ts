/**
 * Date rendering for the profile.
 *
 * Deals and invoices carry a DATE with no time; parsing one with `new Date()`
 * reads it as UTC midnight and shows the previous day west of Greenwich. Both
 * helpers read the parts out of the string instead.
 */

/** "14 Mar 2026", or an em dash when there is no date. */
export function formatDay(iso: string | null | undefined): string {
  const parts = dateParts(iso);
  if (!parts) return "—";
  return parts.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Days from today; negative means it has passed. */
export function daysFromToday(iso: string | null | undefined): number | null {
  const target = dateParts(iso);
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function dateParts(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}
