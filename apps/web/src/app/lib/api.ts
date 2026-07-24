import type { AuthResponse } from "../auth/types";
import { AUTH_BASE } from "./config";

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

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${AUTH_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Network-level failure (server down, CORS, offline).
    throw new ApiError(0, "Could not reach the server. Is the gateway running?");
  }

  const data = (await res.json().catch(() => ({}))) as { error?: string } & Partial<T>;
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? "Request failed");
  }
  return data as T;
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
