/** Mirrors the auth module's User view (services/internal/auth/store.go). */
export interface User {
  id: string;
  email: string;
  /** Display name. Set when joining via an invitation; null for plain signups. */
  name?: string | null;
  /** The tenant this user belongs to (see EXPLAINER §13). */
  orgId?: string;
  authProvider: string;
}

/** Response body of a successful /login, /register or invitation accept. */
export interface AuthResponse {
  token: string;
  user: User;
}
