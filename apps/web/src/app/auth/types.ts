/** Mirrors the auth module's User view (services/internal/auth/store.go). */
export interface User {
  id: string;
  email: string;
  authProvider: string;
}

/** Response body of a successful /login or /register call. */
export interface AuthResponse {
  token: string;
  user: User;
}
