import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { useAuthStore } from "../auth/store";
import { integrationsApi } from "../integrations/api";
import { ApiError } from "../lib/api";
import { COMMON_CURRENCIES } from "../lib/money";
import { memberLabel, orgApi, type Member, type NewInvitation } from "../org/api";
import { useWorkspaceStore } from "../org/workspace";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  PageHeader,
  SelectField,
  Skeleton,
  AssigneePicker,
} from "../ui";
import { memberGroups } from "../org/memberGroups";

export default function Team() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const currentUserRole = useAuthStore((s) => s.user?.role);
  const isOwner = currentUserRole === "owner";
  const canManageRoles = isOwner || currentUserRole === "admin";

  const [activeTab, setActiveTab] = useState<"members" | "structure" | "settings">("members");

  const members = useQuery({ queryKey: ["members"], queryFn: orgApi.members, staleTime: 5 * 60_000 });
  const invitations = useQuery({ queryKey: ["invitations"], queryFn: orgApi.invitations });
  const teamStructure = useQuery({ queryKey: ["teamStructure"], queryFn: orgApi.teamStructure });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("sales");
  const [inviteManagerId, setInviteManagerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<NewInvitation | null>(null);

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => orgApi.updateMemberRole(id, role),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      void queryClient.invalidateQueries({ queryKey: ["teamStructure"] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not change role");
    },
  });

  const canEditRole = (m: Member) =>
    canManageRoles && m.id !== currentUserId && (isOwner || m.role !== "owner");

  const assignManager = useMutation({
    mutationFn: ({ memberId, managerId }: { memberId: string; managerId: string | null }) =>
      orgApi.updateMemberManager(memberId, managerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      void queryClient.invalidateQueries({ queryKey: ["teamStructure"] });
    },
  });

  const managers = useMemo(
    () => (members.data ?? []).filter((m) => m.role === "manager" || m.role === "admin" || m.role === "owner"),
    [members.data],
  );

  const requestRoleChange = (m: Member, role: string) => {
    if (role === (m.role || "sales")) return;
    const confirmed = window.confirm(
      `Change ${memberLabel(m)}'s role to ${ROLE_LABEL[role] ?? role}?` +
        (role === "client" ? "\n\nThey will lose access to the internal workspace." : ""),
    );
    if (!confirmed) return;
    changeRole.mutate({ id: m.id, role });
  };

  const invite = useMutation({
    mutationFn: (payload: { email: string; role: string; managerId: string | null }) =>
      orgApi.invite(payload),
    onSuccess: (inv) => {
      setCreated(inv);
      setInviteEmail("");
      setInviteRole("sales");
      setInviteManagerId("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not create the invitation");
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => orgApi.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invitations"] }),
  });

  const pending = invitations.data ?? [];

  return (
    <section className="flex flex-col gap-lg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Team & Organization"
          subtitle="Manage team members, roles, reporting hierarchies, and workspace settings."
        />
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-surface-muted/70 p-1 border border-line shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "members"
                ? "bg-surface text-fg shadow-xs border border-line/60"
                : "text-fg-muted hover:text-fg"
            }`}
          >
            Members &amp; Roles
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("structure")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "structure"
                ? "bg-surface text-fg shadow-xs border border-line/60"
                : "text-fg-muted hover:text-fg"
            }`}
          >
            Team Structure
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "settings"
                ? "bg-surface text-fg shadow-xs border border-line/60"
                : "text-fg-muted hover:text-fg"
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {activeTab === "settings" && (
        <div className="flex flex-col gap-lg">
          <WorkspaceSettings canManageRoles={canManageRoles} />
          <GoogleCalendarCard />
        </div>
      )}

      {activeTab === "structure" && (
        <div className="flex flex-col gap-lg">
          {/* Structure Overview Cards */}
          <div className="grid gap-md sm:grid-cols-3">
            <Card className="p-4">
              <div className="text-xs font-bold text-fg-muted uppercase tracking-wider">Managers</div>
              <div className="mt-2 text-2xl font-bold text-fg">
                {teamStructure.data?.groups.length ?? 0}
              </div>
              <div className="mt-1 text-xs text-fg-subtle">Designated team heads</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-bold text-fg-muted uppercase tracking-wider">Assigned Engineers</div>
              <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {(teamStructure.data?.groups ?? []).reduce((acc, g) => acc + g.engineers.length, 0)}
              </div>
              <div className="mt-1 text-xs text-fg-subtle">Engineers reporting to a manager</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-bold text-fg-muted uppercase tracking-wider">Unassigned Engineers</div>
              <div className={`mt-2 text-2xl font-bold ${
                (teamStructure.data?.unassigned.length ?? 0) > 0 ? "text-amber-500" : "text-fg"
              }`}>
                {teamStructure.data?.unassigned.length ?? 0}
              </div>
              <div className="mt-1 text-xs text-fg-subtle">Pending manager assignment</div>
            </Card>
          </div>

          {teamStructure.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-36 w-full rounded-2xl" />
              <Skeleton className="h-36 w-full rounded-2xl" />
            </div>
          ) : (
            <>
              {/* Groups by Manager */}
              <div className="space-y-4">
                {(teamStructure.data?.groups ?? []).map((group) => (
                  <Card key={group.manager.id} padded={false}>
                    <div className="flex flex-col gap-2 p-5 border-b border-line bg-surface-muted/30 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar name={memberLabel(group.manager)} title={group.manager.email} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-fg">{memberLabel(group.manager)}</span>
                            <Badge tone={ROLE_TONE[group.manager.role ?? "manager"] ?? "info"}>
                              {ROLE_LABEL[group.manager.role ?? "manager"] ?? group.manager.role}
                            </Badge>
                          </div>
                          <span className="text-xs text-fg-muted">{group.manager.email}</span>
                        </div>
                      </div>
                      <div className="text-xs font-medium text-fg-muted">
                        <span className="font-bold text-fg">{group.engineers.length}</span> engineer
                        {group.engineers.length === 1 ? "" : "s"} reporting
                      </div>
                    </div>

                    {group.engineers.length === 0 ? (
                      <div className="p-6 text-center text-xs text-fg-muted">
                        No engineers assigned to {memberLabel(group.manager)} yet.
                      </div>
                    ) : (
                      <ul className="divide-y divide-line">
                        {group.engineers.map((eng) => (
                          <li
                            key={eng.id}
                            className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between hover:bg-surface-hover/40 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar name={memberLabel(eng)} title={eng.email} />
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-fg truncate">
                                  {memberLabel(eng)}
                                </div>
                                <div className="text-xs text-fg-muted truncate">{eng.email}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-center">
                              {/* Active Tasks Badge */}
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  eng.activeTasks > 4
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                    : eng.activeTasks > 0
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    : "bg-surface-muted text-fg-subtle border border-line"
                                }`}
                              >
                                {eng.activeTasks} active task{eng.activeTasks === 1 ? "" : "s"}
                              </span>

                              {canManageRoles && (
                                <AssigneePicker
                                  size="sm"
                                  className="w-48"
                                  triggerClassName="h-8 font-medium"
                                  groups={memberGroups(managers, { exclude: eng.id })}
                                  value={eng.managerId ?? ""}
                                  disabled={assignManager.isPending}
                                  onChange={(id) =>
                                    assignManager.mutate({
                                      memberId: eng.id,
                                      managerId: id || null,
                                    })
                                  }
                                  ariaLabel={`Reassign manager for ${memberLabel(eng)}`}
                                  allowUnassigned
                                  unassignedLabel="No manager"
                                />
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                ))}

                {/* Unassigned Engineers Section */}
                {(teamStructure.data?.unassigned ?? []).length > 0 && (
                  <Card padded={false} className="border-amber-500/30">
                    <div className="flex items-center justify-between p-5 border-b border-line bg-amber-500/5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          <h3 className="text-sm font-bold text-fg">Unassigned Engineers</h3>
                        </div>
                        <p className="text-xs text-fg-muted mt-0.5">
                          These engineers do not have a reporting manager assigned yet.
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {teamStructure.data?.unassigned.length} Pending
                      </span>
                    </div>

                    <ul className="divide-y divide-line">
                      {teamStructure.data?.unassigned.map((eng) => (
                        <li
                          key={eng.id}
                          className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between hover:bg-surface-hover/40 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar name={memberLabel(eng)} title={eng.email} />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-fg truncate">
                                {memberLabel(eng)}
                              </div>
                              <div className="text-xs text-fg-muted truncate">{eng.email}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-surface-muted text-fg-subtle border border-line">
                              {eng.activeTasks} active task{eng.activeTasks === 1 ? "" : "s"}
                            </span>

                            {canManageRoles && (
                              <AssigneePicker
                                size="sm"
                                className="w-48"
                                triggerClassName="h-8 font-semibold !border-amber-500/40"
                                groups={memberGroups(managers, { exclude: eng.id })}
                                value=""
                                disabled={assignManager.isPending}
                                onChange={(id) => {
                                  if (id) {
                                    assignManager.mutate({
                                      memberId: eng.id,
                                      managerId: id,
                                    });
                                  }
                                }}
                                ariaLabel={`Assign manager for ${memberLabel(eng)}`}
                                placeholder="Assign to Manager…"
                              />
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "members" && (
        <div className={`grid gap-md ${canManageRoles ? "lg:grid-cols-2" : "max-w-4xl"}`}>
          <Card padded={false}>
            <div className="px-lg py-md">
              <CardHeader
                title="Members"
                subtitle={members.data ? `${members.data.length} in this workspace` : undefined}
              />
            </div>
            <ul className="border-t border-line">
              {members.isPending &&
                Array.from({ length: 2 }).map((_, i) => (
                  <li key={i} className="px-lg py-md">
                    <Skeleton className="h-[28px] w-full" />
                  </li>
                ))}
              {(members.data ?? []).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-md border-b border-line px-lg py-md last:border-0"
                >
                  <div className="flex items-center gap-md min-w-0">
                    <Avatar name={memberLabel(m)} title={m.email} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-xs">
                        <p className="truncate text-sm font-medium text-fg">{memberLabel(m)}</p>
                        {m.id === currentUserId && <Badge tone="brand">You</Badge>}
                      </div>
                      {m.name && <p className="truncate text-xs text-fg-muted">{m.email}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-sm">
                    {m.role === "engineer" && (
                      canManageRoles ? (
                        <AssigneePicker
                          size="sm"
                          className="w-44"
                          triggerClassName="h-8 font-medium"
                          groups={memberGroups(managers, { exclude: m.id })}
                          value={m.managerId ?? ""}
                          disabled={assignManager.isPending}
                          onChange={(id) =>
                            assignManager.mutate({
                              memberId: m.id,
                              managerId: id || null,
                            })
                          }
                          ariaLabel={`Assigned Manager for ${memberLabel(m)}`}
                          allowUnassigned
                          unassignedLabel="No manager"
                        />
                      ) : (
                        m.managerName && (
                          <span className="text-[11px] text-fg-subtle">
                            Mgr: {m.managerName}
                          </span>
                        )
                      )
                    )}

                    {canEditRole(m) ? (
                      <select
                        value={m.role || "sales"}
                        disabled={changeRole.isPending}
                        onChange={(e) => requestRoleChange(m, e.target.value)}
                        aria-label={`Role for ${memberLabel(m)}`}
                        className="h-8 rounded-md border border-line bg-surface px-2 text-xs font-medium text-fg focus:border-accent focus:outline-none disabled:opacity-60"
                      >
                        {isOwner && <option value="owner">Owner</option>}
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="engineer">Engineer</option>
                        <option value="account_manager">Account Manager</option>
                        <option value="sales">Sales</option>
                        <option value="client">Client</option>
                      </select>
                    ) : (
                      <Badge tone={ROLE_TONE[m.role ?? "sales"] ?? "neutral"}>
                        {ROLE_LABEL[m.role ?? "sales"] ?? "Sales"}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {canManageRoles && (
            <div className="flex flex-col gap-md">
              <Card>
                <CardHeader
                  title="Invite a teammate"
                  subtitle="Assign their role upfront. If inviting an engineer, designate their reporting manager."
                />

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    invite.mutate({
                      email: inviteEmail,
                      role: inviteRole,
                      managerId: inviteRole === "engineer" && inviteManagerId ? inviteManagerId : null,
                    });
                  }}
                  className="mt-md flex flex-col gap-3"
                >
                  <Field
                    label="Email Address"
                    type="email"
                    name="inviteEmail"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    required
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <SelectField
                      label="Role"
                      name="inviteRole"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                    >
                      <option value="engineer">Engineer</option>
                      <option value="manager">Manager</option>
                      <option value="sales">Sales</option>
                      <option value="account_manager">Account Manager</option>
                      <option value="admin">Admin</option>
                      {isOwner && <option value="owner">Owner</option>}
                    </SelectField>

                    {inviteRole === "engineer" ? (
                      <AssigneePicker
                        label="Assign Manager (Optional)"
                        groups={memberGroups(managers)}
                        value={inviteManagerId}
                        onChange={setInviteManagerId}
                        allowUnassigned
                        unassignedLabel="No manager pre-assigned"
                      />
                    ) : (
                      <div className="flex flex-col justify-end pb-1 text-xs text-fg-subtle">
                        Full access to pipeline &amp; commercial deals
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <Button type="submit" disabled={invite.isPending || !inviteEmail}>
                      {invite.isPending ? "Generating invite…" : "Send Invitation"}
                    </Button>
                  </div>
                </form>

                {error && (
                  <div className="mt-md">
                    <Alert>{error}</Alert>
                  </div>
                )}
                {created && <InviteLink invitation={created} onDismiss={() => setCreated(null)} />}
              </Card>

              {pending.length > 0 && (
                <Card padded={false}>
                  <div className="px-lg py-md">
                    <CardHeader title="Pending invitations" />
                  </div>
                  <ul className="border-t border-line">
                    {pending.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex items-center justify-between gap-md border-b border-line px-lg py-md last:border-0"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-fg">{inv.email}</p>
                            <Badge tone={ROLE_TONE[inv.role ?? "sales"] ?? "neutral"}>
                              {ROLE_LABEL[inv.role ?? "sales"] ?? "Sales"}
                            </Badge>
                          </div>
                          <p className="text-xs text-fg-muted mt-0.5">
                            Expires {new Date(inv.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revoke.mutate(inv.id)}
                          disabled={revoke.isPending}
                        >
                          <span className="text-bad-fg">Revoke</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Workspace name and currency. Currency lives here because it is org-wide: every
 * amount on every board is denominated in it, so it isn't a per-record choice.
 */
function WorkspaceSettings({ canManageRoles }: { canManageRoles: boolean }) {
  const queryClient = useQueryClient();
  const workspace = useQuery({
    queryKey: ["workspace"],
    queryFn: orgApi.workspace,
    staleTime: 10 * 60_000,
  });

  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (patch: { name?: string; currency?: string }) => orgApi.updateWorkspace(patch),
    onSuccess: (updated) => {
      // Refresh the store every money formatter reads from, plus anything showing
      // an amount.
      useWorkspaceStore.getState().set({ name: updated.name, currency: updated.currency });
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
      setError(null);
      setSaved(true);
    },
    onError: (err) => {
      setSaved(false);
      setError(err instanceof ApiError ? err.message : "Could not save settings");
    },
  });

  const current = workspace.data;
  // `null` means untouched, so the field follows the server until edited.
  const nameValue = name ?? current?.name ?? "";

  return (
    <Card>
      <CardHeader
        title="Workspace"
        subtitle="The name and currency used across every board and total."
      />

      {error && (
        <div className="mt-md">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-md grid items-end gap-md sm:grid-cols-[1fr_160px_auto]">
        <Field
          label="Name"
          name="workspaceName"
          value={nameValue}
          disabled={!canManageRoles}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
        <SelectField
          label="Currency"
          name="workspaceCurrency"
          value={current?.currency ?? "USD"}
          disabled={!current || !canManageRoles || save.isPending}
          onChange={(e) => save.mutate({ currency: e.target.value })}
        >
          {/* Any 3-letter code is accepted by the API; these are the shortcuts. */}
          {COMMON_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
          {current && !COMMON_CURRENCIES.includes(current.currency as never) && (
            <option value={current.currency}>{current.currency}</option>
          )}
        </SelectField>
        {canManageRoles && (
          <Button
            disabled={save.isPending || !current || nameValue.trim() === current.name}
            onClick={() => save.mutate({ name: nameValue.trim() })}
          >
            {save.isPending ? "Saving…" : saved ? "Saved" : "Save"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function InviteLink({
  invitation,
  onDismiss,
}: {
  invitation: NewInvitation;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invitation.inviteUrl);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions). The link is on
      // screen and selectable either way.
      setCopied(false);
    }
  };

  return (
    <div className="mt-md rounded-md border border-accent/30 bg-accent-soft/60 p-md">
      <p className="text-sm font-medium text-fg">
        Invitation for {invitation.email} created
      </p>
      <p className="mt-xs text-xs text-fg-muted">
        Shown once — copy it now, it can&apos;t be retrieved later.
      </p>
      <div className="mt-sm flex items-center gap-sm">
        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-sm border border-line bg-surface px-sm py-xs text-xs text-fg">
          {invitation.inviteUrl}
        </code>
        <Button variant="secondary" size="sm" icon={copied ? "check" : undefined} onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Done
        </Button>
      </div>
    </div>
  );
}


/**
 * Connect or disconnect the Google Calendar used to book calls.
 *
 * The consent round trip returns to /app/team with ?connected or ?connectError,
 * which is read once on mount so the outcome is visible without the user having
 * to guess whether it worked.
 */
function GoogleCalendarCard() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const connections = useQuery({
    queryKey: ["integrations"],
    queryFn: integrationsApi.list,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) setNotice("Google Calendar connected.");
    if (params.get("connectError")) setError(params.get("connectError"));
    if (params.has("connected") || params.has("connectError")) {
      // Clear the query so a refresh does not replay the message.
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const google = (connections.data ?? []).find((c) => c.provider === "google");

  const disconnect = useMutation({
    mutationFn: integrationsApi.disconnectGoogle,
    onSuccess: () => {
      setNotice("Google Calendar disconnected.");
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Could not disconnect"),
  });

  const connect = useMutation({
    mutationFn: integrationsApi.connectGoogle,
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Could not start the connection"),
  });

  return (
    <Card>
      <CardHeader
        title="Google Calendar"
        subtitle="Books a Meet when you schedule a call with a lead."
      />
      {error && <Alert>{error}</Alert>}
      {notice && !error && <p className="mt-sm text-sm text-fg-muted">{notice}</p>}

      <div className="mt-md flex flex-wrap items-center justify-between gap-sm">
        <p className="text-sm text-fg-muted">
          {google
            ? `Connected${google.providerAccountId ? "" : ""} — calls you book create a Google Meet on your calendar.`
            : "Not connected. Booking a call will ask you to connect first."}
        </p>
        {google ? (
          <Button
            variant="secondary"
            disabled={disconnect.isPending}
            onClick={() => disconnect.mutate()}
          >
            Disconnect
          </Button>
        ) : (
          <Button disabled={connect.isPending} onClick={() => connect.mutate()}>
            Connect Google Calendar
          </Button>
        )}
      </div>
    </Card>
  );
}

/** The roles profiles_role_check allows, in the words the team page uses. */
const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  engineer: "Engineer",
  account_manager: "Account Manager",
  sales: "Sales",
  client: "Client",
};

const ROLE_TONE: Record<string, "brand" | "info" | "neutral"> = {
  owner: "brand",
  admin: "brand",
  manager: "info",
  engineer: "neutral",
  account_manager: "info",
  sales: "neutral",
  client: "neutral",
};
