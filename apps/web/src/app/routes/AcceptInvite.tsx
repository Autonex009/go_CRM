import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { AuthLayout } from "../auth/AuthLayout";
import { useAuthStore } from "../auth/store";
import { ApiError } from "../lib/api";
import { orgApi } from "../org/api";
import { Alert, Button, Field } from "../ui";

/**
 * Reads the invite token from the URL fragment once, then strips it.
 *
 * The key is `invite`, not `token`: `bootstrapAuth()` claims `#token=` on boot as
 * an SSO access token, and would swallow this before the page rendered.
 */
function captureInviteToken(): string | null {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash;
  if (!hash.startsWith("#")) return null;

  const token = new URLSearchParams(hash.slice(1)).get("invite");
  if (!token) return null;

  history.replaceState(null, "", window.location.pathname + window.location.search);
  return token;
}

export default function AcceptInvite() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  // Captured during the first render so a re-render can't lose it to the strip.
  const [token] = useState(captureInviteToken);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <AuthLayout title="Invitation link" subtitle="Something's missing">
        <Alert>
          This link doesn&apos;t contain an invitation. Ask whoever invited you to send a fresh
          one.
        </Alert>
      </AuthLayout>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { token: access, user } = await orgApi.accept(token, name, password);
      // Accepting signs the teammate straight in — no round trip to the login
      // form. The refresh cookie came back on the same response.
      setSession(access, user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not accept this invitation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Join the workspace" subtitle="Set a password to finish">
      <form onSubmit={onSubmit} className="flex flex-col gap-md" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field
          label="Your name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Optional"
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" disabled={submitting} className="mt-xs w-full">
          {submitting ? "Joining…" : "Join workspace"}
        </Button>
      </form>
    </AuthLayout>
  );
}
