import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { loginSchema, type LoginInput } from "@go-crm/schemas";

import { AuthLayout } from "../auth/AuthLayout";
import { SsoButtons } from "../auth/SsoButtons";
import { useAuthStore, useIsAuthenticated } from "../auth/store";
import { ApiError, authApi } from "../lib/api";
import { zodResolver } from "../lib/zodResolver";
import { Alert, Button, Divider, Field } from "../ui";

export default function Login() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const authenticated = useIsAuthenticated();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // Already signed in (e.g. persisted session) — skip the form.
  if (authenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      const { token, user } = await authApi.login(email, password);
      setSession(token, user);
      navigate("/", { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  });

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back to go-CRM">
      <form onSubmit={onSubmit} className="flex flex-col gap-md" noValidate>
        {formError && <Alert>{formError}</Alert>}
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        <Button type="submit" disabled={isSubmitting} className="mt-xs w-full">
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="my-lg">
        <Divider>or continue with</Divider>
      </div>
      <SsoButtons />

      <p className="mt-lg text-center text-sm text-fg-muted">
        Don&apos;t have an account?{" "}
        <Link to="/register" className="font-medium text-accent hover:text-accent-on">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
