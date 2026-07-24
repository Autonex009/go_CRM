import { useAuthStore } from "./store";
import { captureTokenFromHash } from "./token";

let ran = false;

/**
 * One-time boot step: if we've just returned from an SSO redirect, the access
 * token is in the URL fragment. Capture it into the session store before the
 * first render so an authenticated return doesn't briefly flash the login page.
 */
export function bootstrapAuth(): void {
  if (ran) return;
  ran = true;

  const token = captureTokenFromHash();
  if (token) {
    useAuthStore.getState().setSession(token);
  }
}
