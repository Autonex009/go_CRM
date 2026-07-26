import { create } from "zustand";
import { persist } from "zustand/middleware";

import { decodeJwt, isExpired } from "./token";
import type { User } from "./types";

interface AuthState {
  token: string | null;
  user: User | null;
  /**
   * Records a new session. `user` is provided by /login and /register; for the
   * SSO flow only a token is available, so a minimal user is derived from its
   * claims.
   */
  setSession: (token: string, user?: User | null) => void;
  logout: () => void;
}

/** Builds a minimal User from token claims (used for the SSO return path). */
function deriveUser(token: string): User | null {
  const claims = decodeJwt(token);
  if (!claims) return null;
  return { id: claims.sub, email: claims.email, orgId: claims.org, authProvider: "sso" };
}

/**
 * Session store. Persisted to localStorage so a refresh keeps the user signed
 * in until the access token expires. This is the "auth session" client state
 * referenced in app/store.ts; server state still lives in TanStack Query.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) =>
        set({ token, user: user ?? deriveUser(token) }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: "gocrm.auth" },
  ),
);

/** Reactive check that a non-expired token is present. */
export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => !!s.token && !isExpired(decodeJwt(s.token)));
}
