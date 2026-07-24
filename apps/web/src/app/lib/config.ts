// Base URL of the Go gateway API. Configured via PUBLIC_API_URL (see
// .env.example); falls back to the local gateway for development.
const API_URL = (import.meta.env.PUBLIC_API_URL ?? "http://localhost:8080").replace(/\/+$/, "");

/** Auth endpoints are mounted at /api/v1/auth by the gateway. */
export const AUTH_BASE = `${API_URL}/api/v1/auth`;
