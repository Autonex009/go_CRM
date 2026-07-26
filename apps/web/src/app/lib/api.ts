import { useAuthStore } from "../auth/store";
import type { AuthResponse } from "../auth/types";
import { API_URL, AUTH_BASE } from "./config";

/** Error carrying the HTTP status and the gateway's `{ "error": ... }` message. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Performs the call and normalizes both transport and API-level failures. */
async function request<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    // Network-level failure (server down, CORS, offline).
    throw new ApiError(0, "Could not reach the server. Is the gateway running?");
  }

  // 204 No Content (e.g. DELETE) has no body to parse.
  if (res.status === 204) {
    return undefined as T;
  }

  const data = (await res.json().catch(() => ({}))) as { error?: string } & Partial<T>;
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? "Request failed");
  }
  return data as T;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  return request<T>(`${AUTH_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Authenticated call to the gateway: attaches the bearer token from the session
 * store to `path` (an absolute API path such as "/api/v1/contacts").
 *
 * On 401 it clears the session rather than redirecting by hand — ProtectedRoute
 * is subscribed to the store, so the next render sends the user to /login. That
 * also covers the case an idle tab can't detect on its own: a token that expired
 * while nothing was rendering.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    return await request<T>(`${API_URL}${path}`, { ...init, headers });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      useAuthStore.getState().logout();
    }
    throw err;
  }
}

export const authApi = {
  login: (email: string, password: string) =>
    postJSON<AuthResponse>("/login", { email, password }),
  register: (email: string, password: string) =>
    postJSON<AuthResponse>("/register", { email, password }),
};

/**
 * Full-page navigation target that starts the provider redirect flow. The
 * gateway redirects to the provider and, after the callback, back to
 * `/app#token=<jwt>` (captured by captureTokenFromHash).
 */
export function ssoUrl(provider: "google" | "github"): string {
  return `${AUTH_BASE}/sso/${provider}`;
}
