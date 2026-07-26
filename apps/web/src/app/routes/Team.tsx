import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useAuthStore } from "../auth/store";
import { Alert } from "../components/AuthLayout";
import { Field } from "../components/Field";
import { ApiError } from "../lib/api";
import { memberLabel, orgApi, type NewInvitation } from "../org/api";
import { initials } from "../leads/stages";

export default function Team() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const members = useQuery({ queryKey: ["members"], queryFn: orgApi.members });
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

  return (
    <section className="flex flex-col gap-lg">
      <header>
        <h1 className="text-xl font-bold text-neutral-900">Team</h1>
        <p className="mt-xs text-sm text-neutral-500">
          People in your workspace. Anyone here can be assigned leads.
        </p>
      </header>

      <div className="rounded-lg border border-neutral-900/10 bg-white">
        <h2 className="border-b border-neutral-900/10 px-lg py-md text-sm font-semibold text-neutral-900">
          Members{members.data ? ` (${members.data.length})` : ""}
        </h2>
        <ul>
          {(members.data ?? []).map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-md border-b border-neutral-900/10 px-lg py-md last:border-0"
            >
              <span className="flex h-[28px] w-[28px] items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700">
                {initials(memberLabel(m))}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-900">{memberLabel(m)}</p>
                {m.name && <p className="truncate text-xs text-neutral-500">{m.email}</p>}
              </div>
              {m.id === currentUserId && (
                <span className="ml-auto rounded-sm bg-neutral-50 px-sm py-[2px] text-xs text-neutral-500">
                  You
                </span>
              )}
            </li>
          ))}
          {members.isPending && <li className="px-lg py-md text-sm text-neutral-500">Loading…</li>}
        </ul>
      </div>

      <div className="rounded-lg border border-neutral-900/10 bg-white p-lg">
        <h2 className="text-sm font-semibold text-neutral-900">Invite a teammate</h2>
        <p className="mt-xs text-sm text-neutral-500">
          Creates a single-use link, valid for 7 days. Email delivery isn&apos;t wired up yet, so
          copy the link and send it yourself.
        </p>

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
          <button
            type="submit"
            disabled={invite.isPending || !email}
            className="rounded-md bg-brand-600 px-md py-sm text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {invite.isPending ? "Creating…" : "Create invite"}
          </button>
        </form>

        {error && (
          <div className="mt-md">
            <Alert>{error}</Alert>
          </div>
        )}
        {created && <InviteLink invitation={created} onDismiss={() => setCreated(null)} />}
      </div>

      {(invitations.data ?? []).length > 0 && (
        <div className="rounded-lg border border-neutral-900/10 bg-white">
          <h2 className="border-b border-neutral-900/10 px-lg py-md text-sm font-semibold text-neutral-900">
            Pending invitations
          </h2>
          <ul>
            {(invitations.data ?? []).map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between border-b border-neutral-900/10 px-lg py-md last:border-0"
              >
                <div>
                  <p className="text-sm text-neutral-900">{inv.email}</p>
                  <p className="text-xs text-neutral-500">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => revoke.mutate(inv.id)}
                  disabled={revoke.isPending}
                  className="text-sm font-medium text-red-600 transition hover:text-red-700 disabled:opacity-60"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
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
      // Clipboard can be blocked (insecure origin, permissions). The link is
      // on screen and selectable either way.
      setCopied(false);
    }
  };

  return (
    <div className="mt-md rounded-md border border-brand-500/40 bg-brand-50/50 p-md">
      <p className="text-sm font-medium text-neutral-900">
        Invitation for {invitation.email} created
      </p>
      <p className="mt-xs text-xs text-neutral-500">
        This link is shown once. Copy it now — it can&apos;t be retrieved later.
      </p>
      <div className="mt-sm flex items-center gap-sm">
        <code className="flex-1 overflow-x-auto rounded-sm bg-white px-sm py-xs text-xs text-neutral-900">
          {invitation.inviteUrl}
        </code>
        <button
          onClick={copy}
          className="shrink-0 rounded-md border border-neutral-900/15 bg-white px-md py-xs text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={onDismiss}
          className="shrink-0 text-sm text-neutral-500 transition hover:text-neutral-900"
        >
          Done
        </button>
      </div>
    </div>
  );
}
