import { create } from "zustand";

import { decodeJwt, isExpired } from "./token";
import type { User } from "./types";

/**
 * `unknown` is the boot state: there may or may not be a session behind the
 * refresh cookie, and we can't tell until the refresh call answers. Route guards
 * must wait rather than bouncing to /login, or every page load would flash the
 * login screen.
 */
type Status = "unknown" | "authenticated" | "anonymous";

interface AuthState {
  token: string | null;
  user: User | null;
  status: Status;
  setSession: (token: string, user?: User | null) => void;
  /** Boot refresh found no session, or the session ended. */
  clear: () => void;
}

/** Builds a minimal User from token claims (used for the SSO return path). */
function deriveUser(token: string): User | null {
  const claims = decodeJwt(token);
  if (!claims) return null;
  return { id: claims.sub, email: claims.email, orgId: claims.org, authProvider: "sso" };
}

/**
 * Session store. **Deliberately not persisted.**
 *
 * The access token lives in memory only: localStorage is readable by any script
 * on the page, so a persisted token turns an XSS bug into a stolen session that
 * outlives the tab. The durable half of the session is the refresh token, which
 * sits in an HttpOnly cookie script cannot touch — so a reload recovers the
 * session through /auth/refresh instead of reading it out of storage.
 */
export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  status: "unknown",
  setSession: (token, user) =>
    set({ token, user: user ?? deriveUser(token), status: "authenticated" }),
  clear: () => set({ token: null, user: null, status: "anonymous" }),
}));

/** Reactive check that a non-expired token is present. */
export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => !!s.token && !isExpired(decodeJwt(s.token)));
}

/** True while the boot refresh is still deciding. */
export function useSessionUnknown(): boolean {
  return useAuthStore((s) => s.status === "unknown");
}
