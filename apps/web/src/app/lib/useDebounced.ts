import { useEffect, useState } from "react";

/**
 * The value, but only once it has stopped changing for `delay` milliseconds.
 *
 * Used to keep a search box off the network on every keystroke: the input stays
 * fully responsive because it renders the raw value, while the query that feeds
 * the request only moves when someone pauses.
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
