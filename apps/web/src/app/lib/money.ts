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

function formatter(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}:${compact}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const options: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
    // Whole units: CRM amounts are estimates, and cents add noise to a card.
    maximumFractionDigits: 0,
    ...(compact ? { notation: "compact", maximumFractionDigits: 1 } : {}),
  };

  let made: Intl.NumberFormat;
  try {
    made = new Intl.NumberFormat(undefined, options);
  } catch {
    // An unknown-but-well-formed code (the server only checks the shape) makes
    // Intl throw. Fall back to plain grouped numbers rather than breaking the page.
    made = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: compact ? 1 : 0,
      ...(compact ? { notation: "compact" } : {}),
    });
  }

  cache.set(key, made);
  return made;
}

/** Full form, for tiles and totals: "$48,000". */
export function formatMoney(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return "—";
  return formatter(currency, false).format(value);
}

/** Compact form, for cards and column headers: "$48K". */
export function formatMoneyCompact(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined || value === 0) return "—";
  return formatter(currency, true).format(value);
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
