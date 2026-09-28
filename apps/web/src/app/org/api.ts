import { apiFetch } from "../lib/api";
import type { AuthResponse } from "../auth/types";

/** Mirrors org.Member — a user of the current organization. */
export interface Member {
  id: string;
  email: string;
  name: string | null;
  authProvider: string;
  role?: string;
  managerId?: string | null;
  managerName?: string | null;
  createdAt: string;
}

/** Mirrors org.Invitation. The raw token is never returned by list endpoints. */
export interface Invitation {
  id: string;
  email: string;
  role?: string;
  managerId?: string | null;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
}

/** An engineer or teammate with active tasks count for team structure hierarchy. */
export interface TeamMember extends Member {
  activeTasks: number;
}

export interface TeamGroup {
  manager: Member;
  engineers: TeamMember[];
}

export interface TeamStructure {
  groups: TeamGroup[];
  unassigned: TeamMember[];
}

/** Mirrors org.NewInvitation — the one and only time the link is available. */
export interface NewInvitation extends Invitation {
  inviteUrl: string;
}

/** Mirrors org.Workspace — the organization's own settings. */
export interface Workspace {
  id: string;
  name: string;
  /** ISO 4217 code every amount in this workspace is denominated in. */
  currency: string;
}

const BASE = "/api/v1/org";

export const orgApi = {
  workspace: () => apiFetch<Workspace>(BASE),

  updateWorkspace: (patch: { name?: string; currency?: string }) =>
    apiFetch<Workspace>(BASE, { method: "PATCH", body: JSON.stringify(patch) }),

  members: () => apiFetch<Member[]>(`${BASE}/members`),

  teamEngineers: (managerId?: string) =>
    apiFetch<Member[]>(`${BASE}/team/engineers${managerId ? `?managerId=${managerId}` : ""}`),

  teamStructure: () => apiFetch<TeamStructure>(`${BASE}/team/structure`),

  getOnboardingStatus: () => apiFetch<{ onboarded: boolean }>(`${BASE}/me/onboarding`),

  completeOnboarding: () =>
    apiFetch<{ onboarded: boolean }>(`${BASE}/me/onboarded`, { method: "POST" }),

  invitations: () => apiFetch<Invitation[]>(`${BASE}/invitations`),

  invite: (input: string | { email: string; role?: string; managerId?: string | null }) => {
    const payload = typeof input === "string" ? { email: input } : input;
    return apiFetch<NewInvitation>(`${BASE}/invitations`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  revoke: (id: string) =>
    apiFetch<void>(`${BASE}/invitations/${id}`, { method: "DELETE" }),

  updateMemberRole: (id: string, role: string) =>
    apiFetch<Member>(`${BASE}/members/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  updateMemberManager: (id: string, managerId: string | null) =>
    apiFetch<Member>(`${BASE}/members/${id}/manager`, {
      method: "PATCH",
      body: JSON.stringify({ managerId }),
    }),

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
