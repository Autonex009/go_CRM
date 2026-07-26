import { apiFetch } from "../lib/api";
import type { AuthResponse } from "../auth/types";

/** Mirrors org.Member — a user of the current organization. */
export interface Member {
  id: string;
  email: string;
  name: string | null;
  authProvider: string;
  createdAt: string;
}

/** Mirrors org.Invitation. The raw token is never returned by list endpoints. */
export interface Invitation {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
}

/** Mirrors org.NewInvitation — the one and only time the link is available. */
export interface NewInvitation extends Invitation {
  inviteUrl: string;
}

const BASE = "/api/v1/org";

export const orgApi = {
  members: () => apiFetch<Member[]>(`${BASE}/members`),

  invitations: () => apiFetch<Invitation[]>(`${BASE}/invitations`),

  invite: (email: string) =>
    apiFetch<NewInvitation>(`${BASE}/invitations`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  revoke: (id: string) =>
    apiFetch<void>(`${BASE}/invitations/${id}`, { method: "DELETE" }),

  /** Public: the invite token in the link is the credential. */
  accept: (token: string, name: string, password: string) =>
    apiFetch<AuthResponse>(`${BASE}/invitations/accept`, {
      method: "POST",
      body: JSON.stringify({ token, name, password }),
    }),
};

/** Display name for a member, falling back to their email. */
export function memberLabel(member: Pick<Member, "name" | "email">): string {
  return member.name?.trim() || member.email;
}
