/**
 * Due dates are calendar days, not instants: an action due "12 Sep" is due that
 * whole day wherever you read it from. The API stores them as
 * `YYYY-MM-DDT00:00:00Z`, so every comparison here works on the date part of
 * the string rather than converting to a local instant — otherwise a browser at
 * a negative UTC offset would read midnight-UTC as the previous day and report
 * everything as a day overdue.
 */

const MS_PER_DAY = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The local calendar day as `YYYY-MM-DD`. */
export function localDay(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A whole calendar day, as the inclusive ISO bounds the API filters on. */
export function dayRange(date: Date = new Date()): {
  start: string;
  end: string;
} {
  const day = localDay(date);
  return { start: `${day}T00:00:00Z`, end: `${day}T23:59:59Z` };
}

/** Monday to Sunday around `date`, as inclusive ISO bounds. */
export function weekRange(date: Date = new Date()): {
  start: string;
  end: string;
} {
  const dayOfWeek = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: `${localDay(monday)}T00:00:00Z`,
    end: `${localDay(sunday)}T23:59:59Z`,
  };
}

/** The last instant before today — the upper bound of "overdue". */
export function beforeToday(date: Date = new Date()): string {
  const yesterday = new Date(date);
  yesterday.setDate(date.getDate() - 1);
  return `${localDay(yesterday)}T23:59:59Z`;
}

/** Whole days from today to `dueAt`: negative is overdue, 0 is today. */
export function daysUntil(dueAt: string, now: Date = new Date()): number {
  const [y, m, d] = dueAt.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return 0;
  const due = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / MS_PER_DAY);
}
