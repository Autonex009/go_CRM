import { AUTH_BASE } from "../lib/config";
import { useAuthStore } from "./store";
import type { AuthResponse } from "./types";

/**
 * Session lifecycle against the refresh cookie.
 *
 * Kept out of lib/api.ts to avoid a cycle: apiFetch needs to refresh on a 401,
 * and refreshing needs a bare fetch that deliberately does *not* go through the
 * 401 handling.
 */

/**
 * In-flight refresh, so N concurrent 401s produce one rotation.
 *
 * This matters for correctness, not just efficiency: refresh tokens are
 * single-use, so two parallel refreshes would spend the same token twice — and
 * the server reads a replayed token as theft and kills every session for the user.
 */
let inFlight: Promise<boolean> | null = null;

/**
 * Exchanges the refresh cookie for a new access token. Returns whether a session
 * was recovered. Never throws.
 */
export function refreshSession(): Promise<boolean> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch(`${AUTH_BASE}/refresh`, {
        method: "POST",
        // Required for the cookie to be sent (and for Set-Cookie to be honoured)
        // on a cross-origin call.
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        useAuthStore.getState().clear();
        return false;
      }

      const data = (await res.json()) as AuthResponse;
      useAuthStore.getState().setSession(data.token, data.user);
      return true;
    } catch {
      // Network failure: don't wipe a session we can't disprove — but the store
      // still needs to leave the `unknown` boot state.
      const { token, clear } = useAuthStore.getState();
      if (!token) clear();
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Revokes the session server-side, then clears it locally. */
export async function endSession(): Promise<void> {
  try {
    await fetch(`${AUTH_BASE}/logout`, { method: "POST", credentials: "include" });
  } catch {
    // Even if the call fails, drop the local session — the access token expires
    // within minutes regardless.
  }
  useAuthStore.getState().clear();
}
