import { refreshSession } from "../auth/session";
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

/**
 * Public auth calls. `credentials: "include"` so the refresh cookie the server
 * sets on login/register is actually stored by the browser.
 */
async function postJSON<T>(path: string, body: unknown): Promise<T> {
  return request<T>(`${AUTH_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildInit(init: RequestInit, token: string | null): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return { ...init, credentials: "include", headers };
}

/**
 * Authenticated call to the gateway: attaches the bearer token from the session
 * store to `path` (an absolute API path such as "/api/v1/contacts").
 *
 * On 401 it tries **one** silent refresh and replays the request. That is what
 * makes a 15-minute access token invisible: the token expiring mid-session costs
 * one extra round-trip, not a trip to the login screen. If the refresh fails the
 * session is cleared, and ProtectedRoute — subscribed to the store — redirects on
 * the next render.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;

  try {
    return await request<T>(url, buildInit(init, useAuthStore.getState().token));
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;

    // Single-flight inside refreshSession, so parallel 401s rotate once.
    const recovered = await refreshSession();
    if (!recovered) throw err;

    return request<T>(url, buildInit(init, useAuthStore.getState().token));
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
 * `/app#token=<jwt>` (captured by captureTokenFromHash) with the refresh cookie
 * already set.
 */
export function ssoUrl(provider: "google" | "github"): string {
  return `${AUTH_BASE}/sso/${provider}`;
}
