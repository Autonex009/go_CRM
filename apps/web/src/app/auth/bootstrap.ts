import { refreshSession } from "./session";
import { useAuthStore } from "./store";
import { captureTokenFromHash } from "./token";

let ran = false;

/**
 * One-time boot step, run before the first render.
 *
 * Two ways in:
 *   1. **SSO return** — the access token is in the URL fragment. Take it
 *      synchronously so an authenticated return doesn't flash the login page.
 *   2. **Everything else** — ask /auth/refresh whether the HttpOnly cookie still
 *      names a live session. This is what replaces reading a token out of
 *      localStorage, and is why a reload no longer signs the user out.
 *
 * Returns a promise only in case 2; the store starts in `status: "unknown"` and
 * route guards wait on it rather than redirecting.
 */
export function bootstrapAuth(): void {
  if (ran) return;
  ran = true;

  const token = captureTokenFromHash();
  if (token) {
    useAuthStore.getState().setSession(token);
    return;
  }

  void refreshSession();
}
