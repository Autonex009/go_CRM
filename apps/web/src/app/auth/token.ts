/** Claims embedded in the access token (see services/internal/auth/jwt.go). */
export interface JwtClaims {
  sub: string;
  email: string;
  /** Organization id — the gateway scopes every query by it. */
  org: string;
  iss: string;
  iat: number;
  exp: number;
}

/**
 * Decodes a JWT's payload without verifying its signature. The gateway is the
 * source of truth for validity; this only lets the SPA read `sub`/`email`/`exp`
 * for display and expiry checks.
 */
export function decodeJwt(token: string): JwtClaims | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

/** True when the token is missing/malformed or its `exp` is in the past. */
export function isExpired(claims: JwtClaims | null): boolean {
  if (!claims?.exp) return true;
  return claims.exp * 1000 <= Date.now();
}

/**
 * SSO delivers the access token in the URL fragment (`/app#token=<jwt>`), which
 * is never sent to a server. Read it once on boot and strip it from the URL so
 * it doesn't linger in history or get copy-pasted.
 */
export function captureTokenFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash.startsWith("#")) return null;

  const token = new URLSearchParams(hash.slice(1)).get("token");
  if (!token) return null;

  history.replaceState(null, "", window.location.pathname + window.location.search);
  return token;
}
