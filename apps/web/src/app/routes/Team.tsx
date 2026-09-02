import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useAuthStore } from "../auth/store";
import { integrationsApi } from "../integrations/api";
import { ApiError } from "../lib/api";
import { COMMON_CURRENCIES } from "../lib/money";
import { memberLabel, orgApi, type NewInvitation } from "../org/api";
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
} from "../ui";

export default function Team() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const members = useQuery({ queryKey: ["members"], queryFn: orgApi.members, staleTime: 5 * 60_000 });
  const invitations = useQuery({ queryKey: ["invitations"], queryFn: orgApi.invitations });

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Shown once, after a successful invite: there is no mail sender, so the
  // inviter copies this link and sends it themselves.
  const [created, setCreated] = useState<NewInvitation | null>(null);

  const invite = useMutation({
    mutationFn: (address: string) => orgApi.invite(address),
    onSuccess: (inv) => {
      setCreated(inv);
      setEmail("");
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
      <PageHeader
        title="Team"
        subtitle="People in your workspace. Anyone here can be assigned leads."
      />

      <WorkspaceSettings />

      <GoogleCalendarCard />

      <div className="grid gap-md lg:grid-cols-2">
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
                className="flex items-center gap-md border-b border-line px-lg py-md last:border-0"
              >
                <Avatar name={memberLabel(m)} title={m.email} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{memberLabel(m)}</p>
                  {m.name && <p className="truncate text-xs text-fg-muted">{m.email}</p>}
                </div>
                {m.id === currentUserId && (
                  <span className="ml-auto">
                    <Badge tone="brand">You</Badge>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-md">
          <Card>
            <CardHeader
              title="Invite a teammate"
              subtitle="Single-use link, valid for 7 days. Email delivery isn't wired up yet — copy the link and send it yourself."
            />

            <form
              onSubmit={(e) => {
                e.preventDefault();
                invite.mutate(email);
              }}
              className="mt-md flex flex-col gap-md sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <Field
                  label="Email"
                  type="email"
                  name="inviteEmail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@company.com"
                />
              </div>
              <Button type="submit" disabled={invite.isPending || !email}>
                {invite.isPending ? "Creating…" : "Create invite"}
              </Button>
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
                      <p className="truncate text-sm text-fg">{inv.email}</p>
                      <p className="text-xs text-fg-muted">
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
      </div>
    </section>
  );
}

/**
 * Workspace name and currency. Currency lives here because it is org-wide: every
 * amount on every board is denominated in it, so it isn't a per-record choice.
 */
function WorkspaceSettings() {
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
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
        <SelectField
          label="Currency"
          name="workspaceCurrency"
          value={current?.currency ?? "USD"}
          disabled={!current || save.isPending}
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
        <Button
          disabled={save.isPending || !current || nameValue.trim() === current.name}
          onClick={() => save.mutate({ name: nameValue.trim() })}
        >
          {save.isPending ? "Saving…" : saved ? "Saved" : "Save"}
        </Button>
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
