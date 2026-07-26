import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useAuthStore } from "../auth/store";
import { ApiError } from "../lib/api";
import { memberLabel, orgApi, type NewInvitation } from "../org/api";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  PageHeader,
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

      <div className="grid gap-md lg:grid-cols-2">
        <Card padded={false}>
          <div className="px-lg py-md">
            <CardHeader
              title="Members"
              subtitle={members.data ? `${members.data.length} in this workspace` : undefined}
            />
          </div>
          <ul className="border-t border-neutral-200">
            {members.isPending &&
              Array.from({ length: 2 }).map((_, i) => (
                <li key={i} className="px-lg py-md">
                  <Skeleton className="h-[28px] w-full" />
                </li>
              ))}
            {(members.data ?? []).map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-md border-b border-neutral-200 px-lg py-md last:border-0"
              >
                <Avatar name={memberLabel(m)} title={m.email} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">{memberLabel(m)}</p>
                  {m.name && <p className="truncate text-xs text-neutral-500">{m.email}</p>}
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
              <ul className="border-t border-neutral-200">
                {pending.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-md border-b border-neutral-200 px-lg py-md last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-neutral-900">{inv.email}</p>
                      <p className="text-xs text-neutral-500">
                        Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revoke.mutate(inv.id)}
                      disabled={revoke.isPending}
                    >
                      <span className="text-danger-600">Revoke</span>
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
    <div className="mt-md rounded-md border border-brand-200 bg-brand-50/60 p-md">
      <p className="text-sm font-medium text-neutral-900">
        Invitation for {invitation.email} created
      </p>
      <p className="mt-xs text-xs text-neutral-500">
        Shown once — copy it now, it can&apos;t be retrieved later.
      </p>
      <div className="mt-sm flex items-center gap-sm">
        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-sm border border-neutral-200 bg-white px-sm py-xs text-xs text-neutral-700">
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
