/**
 * Money formatting, in one place.
 *
 * Amounts are stored as plain numbers; the currency comes from the workspace
 * (see org/workspace.ts). Every surface formats through here so a value never
 * renders with one currency on the board and another on the dashboard.
 */

/**
 * Formatters are cached by (currency, notation). Constructing an
 * Intl.NumberFormat is comparatively expensive and a board formats hundreds of
 * amounts per render — building one per call showed up as the obvious waste.
 */
const cache = new Map<string, Intl.NumberFormat>();

type Mode = "auto" | "exact" | "compact";

function formatter(currency: string, mode: Mode): Intl.NumberFormat {
  const key = `${currency}:${mode}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // Cents are not optional. Rounding to whole units made a 1% discount on $35
  // render as "$35" with a "$0" discount — the arithmetic was right and the
  // screen was lying about it.
  const options: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
    ...(mode === "compact"
      ? { notation: "compact", maximumFractionDigits: 1 }
      : mode === "exact"
        ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        : // auto: no trailing ".00" on round figures, full precision otherwise.
          { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
  };

  let made: Intl.NumberFormat;
  try {
    made = new Intl.NumberFormat(undefined, options);
  } catch {
    // An unknown-but-well-formed code (the server only checks the shape) makes
    // Intl throw. Fall back to plain grouped numbers rather than breaking the page.
    made = new Intl.NumberFormat(undefined, {
      ...(mode === "compact"
        ? { notation: "compact", maximumFractionDigits: 1 }
        : { minimumFractionDigits: mode === "exact" ? 2 : 0, maximumFractionDigits: 2 }),
    });
  }

  cache.set(key, made);
  return made;
}

/** Tiles and totals: "$48,000", "$34.65" — cents only when there are cents. */
export function formatMoney(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return "—";
  return formatter(currency, "auto").format(value);
}

/**
 * Always two decimals, for documents. A quote line reading "$35" next to another
 * reading "$34.65" is the kind of inconsistency that makes a total look wrong
 * even when it isn't.
 */
export function formatMoneyExact(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return "—";
  return formatter(currency, "exact").format(value);
}

/**
 * Compact form for cards and column headers: "$48K".
 *
 * Below 1,000 compact notation gains nothing and starts losing cents ("$34.7"),
 * so small amounts fall through to the exact-ish form.
 */
export function formatMoneyCompact(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined || value === 0) return "—";
  if (Math.abs(value) < 1000) return formatMoney(value, currency);
  return formatter(currency, "compact").format(value);
}

/** A short list for the workspace picker; any 3-letter code is accepted. */
export const COMMON_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "INR",
  "AUD",
  "CAD",
  "SGD",
  "AED",
  "JPY",
] as const;
